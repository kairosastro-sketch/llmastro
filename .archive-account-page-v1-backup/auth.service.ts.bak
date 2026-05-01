import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";
import type { User } from "../db/schema.js";

export interface PublicUser {
  id:            string;
  email:         string;
  name:          string | null;
  avatarUrl:     string | null;
  provider:      string;
  emailVerified: boolean;
  createdAt:     Date;
  updatedAt:     Date;
}

export class AuthService {

  async register(data: { email: string; password: string; name: string }): Promise<PublicUser> {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw Object.assign(new Error("Email already registered"), {
        statusCode: 409, code: "EMAIL_TAKEN",
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const [user] = await db.insert(users).values({
      email: data.email.toLowerCase(),
      name: data.name,
      provider: "local",
      emailVerified: false,
      passwordHash,
    }).returning();

    return this.toPublic(user!);
  }

  async verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    return this.toPublic(user);
  }

  async findById(id: string): Promise<PublicUser | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user ? this.toPublic(user) : null;
  }

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  }

  async validateRefreshToken(token: string): Promise<string | null> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [rt] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          gt(refreshTokens.expiresAt, new Date())
        )
      )
      .limit(1);
    return rt ? rt.userId : null;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  }

  getGoogleAuthUrl(): string {
    const params = new URLSearchParams({
      client_id:     process.env["GOOGLE_CLIENT_ID"] ?? "",
      redirect_uri:  process.env["GOOGLE_CALLBACK_URL"] ?? "",
      response_type: "code",
      scope:         "openid email profile",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  getGithubAuthUrl(): string {
    const params = new URLSearchParams({
      client_id:    process.env["GITHUB_CLIENT_ID"] ?? "",
      redirect_uri: process.env["GITHUB_CALLBACK_URL"] ?? "",
      scope:        "user:email",
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGoogleCallback(_code: string): Promise<PublicUser> {
    throw new Error("OAuth requires a domain — not available on IP");
  }

  async handleGithubCallback(_code: string): Promise<PublicUser> {
    throw new Error("OAuth requires a domain — not available on IP");
  }

  private toPublic(user: User): PublicUser {
    return {
      id:            user.id,
      email:         user.email,
      name:          user.name ?? null,
      avatarUrl:     user.avatarUrl ?? null,
      provider:      user.provider,
      emailVerified: user.emailVerified,
      createdAt:     user.createdAt,
      updatedAt:     user.updatedAt,
    };
  }
}

export const authService = new AuthService();
