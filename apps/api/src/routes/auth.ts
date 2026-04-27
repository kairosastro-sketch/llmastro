// Routes d'authentification.
//
// [SECURITY-V1] Nouveautés :
// - Refresh tokens stockés en DB via storeRefreshToken()
// - Validation DB au /refresh + rotation (revoke ancien + store nouveau)
// - Révocation au /logout via revokeRefreshToken()
// - Rate limit dédié 5/min sur /login et 3/min sur /register

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type {
  JWTPayload, AuthTokens, User,
  SubscriptionStatus,
} from "@astro-platform/types";
import { authService } from "../services/auth.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { subscriptionsService } from "../services/subscriptions.service.js";
import { entitlementsService } from "../services/entitlements.service.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ----------------------------------------------------------
// Schemas
// ----------------------------------------------------------
const registerSchema = {
  body: {
    type: "object",
    required: ["email", "password", "name"],
    properties: {
      email:    { type: "string", format: "email", maxLength: 255 },
      password: { type: "string", minLength: 8, maxLength: 128 },
      name:     { type: "string", minLength: 1, maxLength: 100 },
      timezone: { type: "string", maxLength: 64 },
    },
    additionalProperties: false,
  },
} as const;

const loginSchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email:    { type: "string", format: "email" },
      password: { type: "string" },
    },
    additionalProperties: false,
  },
} as const;

const refreshSchema = {
  body: {
    type: "object",
    properties: {
      refreshToken: { type: "string" },
    },
  },
} as const;

// ----------------------------------------------------------
// Route types
// ----------------------------------------------------------
interface RegisterBody { email: string; password: string; name: string; timezone?: string }
interface LoginBody    { email: string; password: string }
interface RefreshBody  { refreshToken?: string }

// ----------------------------------------------------------
// Plugin
// ----------------------------------------------------------
export const authRoutes: FastifyPluginAsync = async (fastify) => {

  // --------------------------------------------------------
  // POST /auth/register
  // [SECURITY-V1] rate-limited: 3/min/IP
  // --------------------------------------------------------
  fastify.post<{ Body: RegisterBody }>(
    "/register",
    {
      schema: { ...registerSchema, tags: ["auth"] },
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const user = await authService.register(req.body);

      if (req.body.timezone && isValidTz(req.body.timezone)) {
        await db.update(users)
          .set({ timezone: req.body.timezone, updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }

      await subscriptionsService.createForNewUser(user.id, { withTrial: true });

      const tokens = await issueTokens(fastify, user);
      setRefreshCookie(reply, tokens.refreshToken);

      return reply.code(201).send({
        success: true,
        data: { user: sanitizeUser(user), tokens: omitRefresh(tokens) },
      });
    }
  );

  // --------------------------------------------------------
  // POST /auth/login
  // [SECURITY-V1] rate-limited: 5/min/IP
  // --------------------------------------------------------
  fastify.post<{ Body: LoginBody }>(
    "/login",
    {
      schema: { ...loginSchema, tags: ["auth"] },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const user = await authService.verifyCredentials(req.body.email, req.body.password);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Email or password incorrect" },
        });
      }

      const tokens = await issueTokens(fastify, user);
      setRefreshCookie(reply, tokens.refreshToken);

      return reply.send({
        success: true,
        data: { user: sanitizeUser(user), tokens: omitRefresh(tokens) },
      });
    }
  );

  // --------------------------------------------------------
  // POST /auth/refresh
  // [SECURITY-V1] valide en DB + rotation
  // --------------------------------------------------------
  fastify.post<{ Body: RefreshBody }>(
    "/refresh",
    { schema: { ...refreshSchema, tags: ["auth"] } },
    async (req, reply) => {
      const token = req.body.refreshToken ?? req.cookies["refreshToken"];
      if (!token) {
        return reply.code(401).send({
          success: false,
          error: { code: "MISSING_REFRESH_TOKEN", message: "Refresh token required" },
        });
      }

      const payload = await Promise.resolve().then(() => fastify.jwt.verify<JWTPayload>(token)).catch(() => null);
      if (!payload || payload.type !== "refresh") {
        return reply.code(401).send({
          success: false,
          error: { code: "INVALID_REFRESH_TOKEN", message: "Token invalid or expired" },
        });
      }

      // [SECURITY-V1] Vérifie que le token est dans la DB (non révoqué)
      const dbUserId = await authService.validateRefreshToken(token);
      if (!dbUserId || dbUserId !== payload.sub) {
        return reply.code(401).send({
          success: false,
          error: { code: "REVOKED_REFRESH_TOKEN", message: "Refresh token revoked or invalid" },
        });
      }

      const user = await authService.findById(payload.sub);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User no longer exists" },
        });
      }

      // [SECURITY-V1] Rotation : on révoque l'ancien avant d'émettre un nouveau
      await authService.revokeRefreshToken(token);
      const tokens = await issueTokens(fastify, user);
      setRefreshCookie(reply, tokens.refreshToken);

      return reply.send({
        success: true,
        data: { tokens: omitRefresh(tokens) },
      });
    }
  );

  // --------------------------------------------------------
  // POST /auth/logout
  // [SECURITY-V1] révoque le refresh token en DB
  // --------------------------------------------------------
  fastify.post(
    "/logout",
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      const token = req.cookies["refreshToken"];
      if (token) {
        try { await authService.revokeRefreshToken(token); } catch { /* silent */ }
      }
      reply.clearCookie("refreshToken", { path: "/auth" });
      return reply.send({ success: true, data: { message: "Logged out" } });
    }
  );

  // --------------------------------------------------------
  // GET /auth/me
  // --------------------------------------------------------
  fastify.get(
    "/me",
    { preHandler: [authMiddleware], schema: { tags: ["auth"], security: [{ bearerAuth: [] }] } },
    async (req: FastifyRequest, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const user = await authService.findById(ctx.userId);
      if (!user) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
      }

      const planPayload = ctx.subscription
        ? {
            code:             ctx.subscription.planCode,
            name:             await resolvePlanName(ctx.subscription.planCode),
            status:           ctx.subscription.status,
            currentPeriodEnd: ctx.subscription.currentPeriodEnd,
            isTrial:          ctx.subscription.status === "trialing",
          }
        : null;

      return reply.send({
        success: true,
        data: {
          user:         sanitizeUser(user),
          plan:         planPayload,
          entitlements: ctx.entitlements,
        },
      });
    }
  );

  // --------------------------------------------------------
  // GET /auth/google
  // --------------------------------------------------------
  fastify.get("/google", async (_req, reply) => {
    const url = authService.getGoogleAuthUrl();
    return reply.redirect(url);
  });

  // --------------------------------------------------------
  // GET /auth/google/callback
  // --------------------------------------------------------
  fastify.get<{ Querystring: { code: string; state?: string } }>(
    "/google/callback",
    async (req, reply) => {
      const { code } = req.query;
      const user = await authService.handleGoogleCallback(code);

      await subscriptionsService.createForNewUser(user.id, { withTrial: true });

      const tokens = await issueTokens(fastify, user);
      setRefreshCookie(reply, tokens.refreshToken);

      const appUrl = process.env["APP_URL"] ?? "http://localhost:3000";
      return reply.redirect(
        `${appUrl}/auth/callback?token=${tokens.accessToken}`
      );
    }
  );

  // --------------------------------------------------------
  // GET /auth/github
  // --------------------------------------------------------
  fastify.get("/github", async (_req, reply) => {
    const url = authService.getGithubAuthUrl();
    return reply.redirect(url);
  });

  // --------------------------------------------------------
  // GET /auth/github/callback
  // --------------------------------------------------------
  fastify.get<{ Querystring: { code: string } }>(
    "/github/callback",
    async (req, reply) => {
      const { code } = req.query;
      const user = await authService.handleGithubCallback(code);

      await subscriptionsService.createForNewUser(user.id, { withTrial: true });

      const tokens = await issueTokens(fastify, user);
      setRefreshCookie(reply, tokens.refreshToken);

      const appUrl = process.env["APP_URL"] ?? "http://localhost:3000";
      return reply.redirect(
        `${appUrl}/auth/callback?token=${tokens.accessToken}`
      );
    }
  );
};

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
async function issueTokens(
  fastify: { jwt: { sign: (payload: object, options?: object) => string } },
  user: User
): Promise<AuthTokens> {
  const base: Omit<JWTPayload, "type" | "iat" | "exp"> = {
    sub:   user.id,
    email: user.email,
  };

  const accessToken = fastify.jwt.sign(
    { ...base, type: "access" },
    { expiresIn: process.env["JWT_ACCESS_EXPIRES_IN"] ?? "15m" }
  );

  const refreshToken = fastify.jwt.sign(
    { ...base, type: "refresh" },
    { expiresIn: process.env["JWT_REFRESH_EXPIRES_IN"] ?? "7d" }
  );

  // [SECURITY-V1] Stocker le hash du refresh token en DB pour pouvoir le révoquer
  await authService.storeRefreshToken(user.id, refreshToken);

  const expiresIn = 15 * 60;

  return { accessToken, refreshToken, expiresIn };
}

function setRefreshCookie(reply: FastifyReply, token: string): void {
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  reply.setCookie("refreshToken", token, {
    httpOnly: true,
    secure:   process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    path:     "/auth",
    maxAge,
  });
}

function sanitizeUser(user: User): Omit<User, never> {
  return user;
}

function omitRefresh(tokens: AuthTokens): Omit<AuthTokens, "refreshToken"> {
  return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
}

function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const planNameCache = new Map<string, string>();
async function resolvePlanName(code: string): Promise<string> {
  if (planNameCache.has(code)) return planNameCache.get(code)!;
  const all = await subscriptionsService.listAllPlans();
  for (const p of all) planNameCache.set(p.code, p.name);
  return planNameCache.get(code) ?? code;
}
