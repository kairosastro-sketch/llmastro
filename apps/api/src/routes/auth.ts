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
import { authService, type PublicUser } from "../services/auth.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { subscriptionsService } from "../services/subscriptions.service.js";
import { entitlementsService } from "../services/entitlements.service.js";
import { userPreferencesService } from "../services/user-preferences.service.js";
import { growthService } from "../services/growth.service.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { logLoginEvent } from "../services/login-events.service.js";
import { emailVerificationService } from "../services/email-verification.service.js";
// AUTH-JWT-JTI-V1 : pour générer un jti unique par token
import crypto from "crypto";

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
      // [GROWTH-V1-CAPTURE] Optionnels — propagés depuis le cookie
      // first-party posé par le middleware Next.js. Validation côté
      // service (longueur, existence en DB). Caractères invalides =
      // silently ignored, pas d'erreur 400.
      referralCode:  { type: "string", maxLength: 12 },
      affiliateSlug: { type: "string", maxLength: 40 },
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
interface RegisterBody {
  email: string; password: string; name: string; timezone?: string;
  // [GROWTH-V1-CAPTURE]
  referralCode?:  string;
  affiliateSlug?: string;
}
interface LoginBody    { email: string; password: string }
interface RefreshBody  { refreshToken?: string }

// ----------------------------------------------------------
// AUTO-LOCALE-V1 — détection au signup via Accept-Language
// ----------------------------------------------------------
// Le default DB est "fr" (DEFAULT_USER_PREFERENCES.locale dans
// @astro-platform/types). Si le browser envoie un header indiquant
// "en" en tag prioritaire, on override pour éviter qu'un user
// anglophone se retrouve en FR par défaut. Aucun autre tag n'est
// supporté côté app (l'UI est FR/EN uniquement) → "fr" et "rien
// détecté" se résolvent vers le default DB sans write inutile.
//
// On lit uniquement le premier tag listé (le plus prioritaire en
// pratique côté browser) — pas de tri par q= : tous les browsers
// modernes mettent leur langue préférée en tête de liste.
function detectLocaleFromHeader(
  acceptLanguage: string | undefined | null,
): "en" | null {
  if (!acceptLanguage) return null;
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : null;
}

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

      // AUTO-LOCALE-V1 : si le browser indique "en" comme tag prioritaire
      // dans Accept-Language, on patch preferences.locale="en" pour ce
      // nouveau user. Sinon on ne fait rien (default DB = "fr").
      const detectedLocale = detectLocaleFromHeader(req.headers["accept-language"]);
      if (detectedLocale) {
        try {
          await userPreferencesService.update(user.id, { locale: detectedLocale });
        } catch (err) {
          req.log.warn({ err, userId: user.id }, "[auto-locale] preferences update failed — defaulting to fr");
        }
      }

      // [GROWTH-V1-CAPTURE] Ordre important :
      // 1) Affilié d'abord (sa présence influence la règle G-03 côté parrainage)
      // 2) Parrainage ensuite, avec affiliateCaptured passé en flag
      // 3) Trial étendu à 14j si parrainage validé (filleul conserve l'effet
      //    même quand l'affilié gagne sur la commission — G-03).
      // 4) referral_code généré pour le nouveau user (lazy ailleurs, eager ici
      //    parce qu'on a déjà la req sous la main).
      //
      // Sources d'attribution par ordre de priorité :
      //   - req.body (formulaire explicite — l'user a tapé le code)
      //   - req.cookies (posés par le middleware Next.js sur ?ref= / ?aff=)
      const referralInput  = req.body.referralCode  ?? req.cookies["ref_code"];
      const affiliateInput = req.body.affiliateSlug ?? req.cookies["aff_code"];
      const aff = await growthService.captureAffiliate(user.id, affiliateInput);
      const ref = await growthService.captureReferral(
        user.id,
        referralInput,
        aff.status === "captured",
      );
      const trialDays = ref.trialExtended ? 14 : undefined;

      await growthService.ensureReferralCode(user.id).catch((err) => {
        // Non-bloquant : si la génération de code échoue, on log et on
        // continue. Le code sera re-tenté lazy à la prochaine requête auth.
        req.log.warn({ err, userId: user.id }, "[growth] referral_code generation failed (will retry lazy)");
      });

      await subscriptionsService.createForNewUser(user.id, { withTrial: true, trialDays });

      // [ARCHIVE-AUTH-EMAIL-VERIFY-V1] Envoi du mail de vérif fire-and-forget.
      // Un Resend down (ou clé absente en dev) ne doit pas faire échouer le
      // signup — le user pourra resend via /auth/resend-verification depuis
      // le bandeau dashboard. Le service est lui-même no-op si pas configuré.
      void emailVerificationService.sendForUser(user.id, { logger: req.log }).catch((err) => {
        req.log.warn({ err, userId: user.id }, "[email-verification] send at signup failed");
      });

      const tokens = await issueTokens(fastify, user);
      setRefreshCookie(reply, tokens.refreshToken);

      logLoginEvent({
        userId:    user.id,
        email:     user.email,
        kind:      "register",
        success:   true,
        ip:        req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      return reply.code(201).send({
        success: true,
        data: {
          user: sanitizeUser(user),
          tokens: omitRefresh(tokens),
          // [GROWTH-V1-CAPTURE] Permet au front de confirmer la prise
          // en compte (affichage type "Trial étendu à 14 jours ✨").
          growth: {
            referral:  { status: ref.status, trialDays: trialDays ?? 7 },
            affiliate: { status: aff.status },
          },
        },
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
      let user;
      try {
        user = await authService.verifyCredentials(req.body.email, req.body.password);
      } catch (err: unknown) {
        // [ACCOUNT-DELETE-V1] verifyCredentials peut throw ACCOUNT_DELETION_PENDING.
        const e = err as { statusCode?: number; code?: string; message?: string; details?: unknown };
        if (e.code === "ACCOUNT_DELETION_PENDING") {
          return reply.code(403).send({
            success: false,
            error: {
              code:    "ACCOUNT_DELETION_PENDING",
              message: "Account is pending deletion",
              details: e.details,
            },
          });
        }
        throw err;
      }
      if (!user) {
        logLoginEvent({
          userId:    null,
          email:     req.body.email,
          kind:      "login",
          success:   false,
          errorCode: "INVALID_CREDENTIALS",
          ip:        req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        });
        return reply.code(401).send({
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Email or password incorrect" },
        });
      }

      const tokens = await issueTokens(fastify, user);
      setRefreshCookie(reply, tokens.refreshToken);

      logLoginEvent({
        userId:    user.id,
        email:     user.email,
        kind:      "login",
        success:   true,
        ip:        req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

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
      // [SECURITY-V1] Révoquer le refresh token en DB
      const token = req.cookies["refreshToken"];
      if (token) {
        try {
          await authService.revokeRefreshToken(token);
        } catch (err) {
          req.log.error({ err }, "[logout] revokeRefreshToken failed");
        }
      }
      reply.clearCookie("refreshToken", { path: "/" });
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

      // [ADMIN-FOUNDATION-V1-BACKEND] charge le flag is_admin (re-fetch DB, pas via cache)
      const adminRow = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);
      const isAdmin = adminRow[0]?.isAdmin === true;

      return reply.send({
        success: true,
        data: {
          user:         sanitizeUser(user),
          plan:         planPayload,
          entitlements: ctx.entitlements,
          isAdmin,
        },
      });
    }
  );

  // --------------------------------------------------------
  // PATCH /auth/me
  // [ACCOUNT-PAGE-V1] Modification du profil utilisateur.
  // --------------------------------------------------------
  fastify.patch<{ Body: { name?: string } }>(
    "/me",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["auth"],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
          },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      try {
        const updated = await authService.updateProfile(ctx.userId, {
          name: req.body.name,
        });
        return reply.send({
          success: true,
          data: { user: sanitizeUser(updated) },
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message?: string };
        return reply.code(e.statusCode ?? 400).send({
          success: false,
          error: {
            code:    e.code ?? "UPDATE_FAILED",
            message: e.message ?? "Update failed",
          },
        });
      }
    }
  );

  // --------------------------------------------------------
  // DELETE /auth/me
  // [ACCOUNT-DELETE-V1] Soft delete avec période de grâce 30j.
  // --------------------------------------------------------
  fastify.delete<{ Body: { confirmEmail: string } }>(
    "/me",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["auth"],
        body: {
          type: "object",
          required: ["confirmEmail"],
          properties: {
            confirmEmail: { type: "string", format: "email", maxLength: 255 },
          },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 3, timeWindow: "10 minutes" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }
      try {
        const { expiresAt } = await authService.softDeleteAccount(ctx.userId, req.body.confirmEmail);
        reply.clearCookie("refreshToken", { path: "/" });
        return reply.send({
          success: true,
          data: {
            message:   "Account scheduled for deletion",
            expiresAt: expiresAt.toISOString(),
          },
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message?: string };
        return reply.code(e.statusCode ?? 400).send({
          success: false,
          error: {
            code:    e.code ?? "DELETE_FAILED",
            message: e.message ?? "Delete failed",
          },
        });
      }
    }
  );

  // --------------------------------------------------------
  // POST /auth/cancel-deletion
  // [ACCOUNT-DELETE-V1] Annule la suppression pendant la grâce.
  // --------------------------------------------------------
  fastify.post<{ Body: { email: string; password: string } }>(
    "/cancel-deletion",
    {
      schema: {
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email:    { type: "string", format: "email" },
            password: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      try {
        const user = await authService.cancelDeletion(req.body.email, req.body.password);
        const tokens = await issueTokens(fastify, user);
        setRefreshCookie(reply, tokens.refreshToken);
        return reply.send({
          success: true,
          data: {
            user:    sanitizeUser(user),
            tokens:  omitRefresh(tokens),
            message: "Account deletion cancelled",
          },
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message?: string };
        return reply.code(e.statusCode ?? 400).send({
          success: false,
          error: {
            code:    e.code ?? "CANCEL_FAILED",
            message: e.message ?? "Cancel failed",
          },
        });
      }
    }
  );

  // --------------------------------------------------------
  // OAUTH-GOOGLE-FACEBOOK-V1
  // Flow: GET /auth/{provider} → redirect provider authorize
  //       → callback /auth/{provider}/callback?code=&state=
  //       → upsert user → issue our JWT → redirect /auth/callback?token=
  //
  // State CSRF : random nonce stocké en cookie httpOnly oauth_state,
  // comparé au paramètre state au retour du provider. Cookie effacé
  // sitôt vérifié (success ou échec).
  //
  // Erreurs : tout échec (state invalide, code absent, email pris,
  // provider down…) redirige vers /auth/login?oauth_error=<code>
  // pour que le frontend puisse afficher un message FR.
  // --------------------------------------------------------

  // GET /auth/google
  fastify.get("/google", async (_req, reply) => {
    const state = crypto.randomBytes(16).toString("hex");
    setOAuthStateCookie(reply, state);
    return reply.redirect(authService.getGoogleAuthUrl(state));
  });

  // GET /auth/google/callback
  fastify.get<{ Querystring: OAuthCallbackQuery }>(
    "/google/callback",
    async (req, reply) => handleOAuthCallback(fastify, req, reply, "google"),
  );

  // GET /auth/facebook
  fastify.get("/facebook", async (_req, reply) => {
    const state = crypto.randomBytes(16).toString("hex");
    setOAuthStateCookie(reply, state);
    return reply.redirect(authService.getFacebookAuthUrl(state));
  });

  // GET /auth/facebook/callback
  fastify.get<{ Querystring: OAuthCallbackQuery }>(
    "/facebook/callback",
    async (req, reply) => handleOAuthCallback(fastify, req, reply, "facebook"),
  );

  // --------------------------------------------------------
  // ARCHIVE-AUTH-EMAIL-VERIFY-V1
  // POST /auth/verify-email — consomme un token (lien email)
  // POST /auth/resend-verification — re-envoie un nouveau lien
  // --------------------------------------------------------
  fastify.post<{ Body: { token: string } }>(
    "/verify-email",
    {
      schema: {
        tags: ["auth"],
        body: {
          type: "object",
          required: ["token"],
          properties: {
            // Le token raw est base64url 32 bytes → ~43 chars. On laisse
            // une marge max pour tolérer un encodage variant côté client.
            token: { type: "string", minLength: 8, maxLength: 256 },
          },
          additionalProperties: false,
        },
      },
      // Rate-limit modéré : un user peut spammer s'il clique plusieurs fois,
      // mais on veut limiter le brute-force d'enum de tokens (256 bits =
      // pas brute-forceable de toute façon, ceinture+bretelle).
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      try {
        const { userId, alreadyVerified } = await emailVerificationService.verify(req.body.token);
        return reply.send({
          success: true,
          data: { userId, alreadyVerified },
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message?: string };
        return reply.code(e.statusCode ?? 400).send({
          success: false,
          error: {
            code:    e.code ?? "VERIFY_FAILED",
            message: e.message ?? "Verification failed",
          },
        });
      }
    },
  );

  fastify.post(
    "/resend-verification",
    {
      preHandler: [authMiddleware],
      schema: { tags: ["auth"], security: [{ bearerAuth: [] }] },
      // Cap strict : pas plus de 3 envois / heure / user pour éviter
      // qu'un compte compromis serve à spammer.
      config: { rateLimit: { max: 3, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }
      try {
        await emailVerificationService.sendForUser(ctx.userId, { logger: req.log });
        return reply.send({
          success: true,
          data: { message: "Verification email sent" },
        });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string; message?: string };
        return reply.code(e.statusCode ?? 500).send({
          success: false,
          error: {
            code:    e.code ?? "SEND_FAILED",
            message: e.message ?? "Failed to send verification email",
          },
        });
      }
    },
  );
};

// ----------------------------------------------------------
// OAUTH-GOOGLE-FACEBOOK-V1 — helpers callback
// ----------------------------------------------------------
interface OAuthCallbackQuery {
  code?:              string;
  state?:             string;
  error?:             string;
  error_description?: string;
}

function setOAuthStateCookie(reply: FastifyReply, state: string): void {
  reply.setCookie("oauth_state", state, {
    httpOnly: true,
    secure:   process.env["NODE_ENV"] === "production",
    sameSite: "lax",  // 'lax' nécessaire : le provider redirige en GET top-level
    path:     "/",
    maxAge:   10 * 60 * 1000,  // 10 min — temps réaliste de complétion du flow
  });
}

async function handleOAuthCallback(
  fastify:  { jwt: { sign: (payload: object, options?: object) => string } },
  req:      FastifyRequest<{ Querystring: OAuthCallbackQuery }>,
  reply:    FastifyReply,
  provider: "google" | "facebook",
): Promise<unknown> {
  const appUrl = process.env["APP_URL"] ?? "http://localhost:3000";
  const eventKind = provider === "google" ? "oauth_google" : "oauth_facebook";

  const redirectError = (code: string) => {
    return reply.redirect(`${appUrl}/auth/login?oauth_error=${encodeURIComponent(code)}`);
  };

  // 1) Provider a renvoyé une erreur (user a refusé, scope manquant…)
  if (req.query.error) {
    reply.clearCookie("oauth_state", { path: "/" });
    return redirectError(req.query.error);
  }

  // 2) State CSRF
  const cookieState = req.cookies["oauth_state"];
  reply.clearCookie("oauth_state", { path: "/" });
  if (!cookieState || !req.query.state || cookieState !== req.query.state) {
    return redirectError("invalid_state");
  }

  // 3) Code requis
  if (!req.query.code) {
    return redirectError("missing_code");
  }

  // 4) Échange + upsert
  try {
    const { user, isNewUser } = provider === "google"
      ? await authService.handleGoogleCallback(req.query.code)
      : await authService.handleFacebookCallback(req.query.code);

    if (isNewUser) {
      await subscriptionsService.createForNewUser(user.id, { withTrial: true });
    }

    const tokens = await issueTokens(fastify, user);
    setRefreshCookie(reply, tokens.refreshToken);

    logLoginEvent({
      userId:    user.id,
      email:     user.email,
      kind:      eventKind,
      success:   true,
      ip:        req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });

    return reply.redirect(`${appUrl}/auth/callback?token=${tokens.accessToken}`);
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    req.log.warn({ err, provider }, "[oauth] callback failed");
    logLoginEvent({
      userId:    null,
      email:     "",
      kind:      eventKind,
      success:   false,
      errorCode: e.code ?? "OAUTH_FAILED",
      ip:        req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
    return redirectError(e.code ?? "oauth_failed");
  }
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
async function issueTokens(
  fastify: { jwt: { sign: (payload: object, options?: object) => string } },
  user: PublicUser
): Promise<AuthTokens> {
  const base: Omit<JWTPayload, "type" | "iat" | "exp"> = {
    sub:   user.id,
    email: user.email,
  };

  // AUTH-JWT-JTI-V1 : ajout d'un JWT ID (RFC 7519 §4.1.7) random sur chaque
  // token pour garantir l'unicité du JWT même si iat est identique entre
  // deux émissions dans la même seconde (cas register+auto-login, multi-
  // onglets, F5 rapide). Sans jti, fastify.jwt.sign produit des JWT
  // identiques pour le même user dans la même seconde, ce qui provoque
  // des collisions sur la contrainte refresh_tokens_token_hash_key.
  const accessToken = fastify.jwt.sign(
    { ...base, type: "access", jti: crypto.randomUUID() },
    { expiresIn: process.env["JWT_ACCESS_EXPIRES_IN"] ?? "15m" }
  );

  const refreshToken = fastify.jwt.sign(
    { ...base, type: "refresh", jti: crypto.randomUUID() },
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
    path:     "/",
    maxAge,
  });
}

// AUTH-JWT-JTI-V1 applied

// CI-DEBT-PURGE-V1-F: signature alignée sur le type retourné par authService.*
// (PublicUser, qui n'expose pas providerId — voir auth.service.ts).
function sanitizeUser(user: PublicUser): PublicUser {
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

// ADMIN-FOUNDATION-V1-BACKEND applied

// ADMIN-STATS-V1-BACKEND-V2 applied

// CI-DEBT-PURGE-V1-F applied

// CI-DEBT-PURGE-V1-G applied

// ARCHIVE-AUTH-EMAIL-VERIFY-V1 applied
