import { eq, and, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";
import type { User } from "../db/schema.js";

// [ACCOUNT-DELETE-V1] Période de grâce pour annuler la suppression d'un compte.
const GRACE_PERIOD_DAYS = 30;

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

    // [ACCOUNT-DELETE-V1] Soft delete check : refuse les credentials valides
    // si compte programmé pour suppression. Le flow undelete passe par
    // une route dédiée /auth/cancel-deletion (cf. routes/auth.ts).
    if (user.deletedAt) {
      const graceMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(user.deletedAt.getTime() + graceMs);
      if (Date.now() < expiresAt.getTime()) {
        throw Object.assign(new Error("Account deletion pending"), {
          statusCode: 403,
          code:       "ACCOUNT_DELETION_PENDING",
          details:    { expiresAt: expiresAt.toISOString() },
        });
      }
      // Au-delà de la période de grâce : compte considéré comme inexistant.
      // Le cron de purge le supprimera vraiment.
      return null;
    }

    return this.toPublic(user);
  }

  async findById(id: string): Promise<PublicUser | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, id),
        isNull(users.deletedAt),
      ))
      .limit(1);
    return user ? this.toPublic(user) : null;
  }

  // ----------------------------------------------------------
  // [ACCOUNT-DELETE-V1] Soft delete avec période de grâce
  // ----------------------------------------------------------

  /** Programme la suppression du compte. Révoque tous les refresh tokens. */
  async softDeleteAccount(userId: string, confirmEmail: string): Promise<{ expiresAt: Date }> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404, code: "USER_NOT_FOUND",
      });
    }

    if (user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
      throw Object.assign(new Error("Email confirmation does not match"), {
        statusCode: 400, code: "EMAIL_MISMATCH",
      });
    }

    const now = new Date();
    await db.update(users)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(users.id, userId));

    // Révoque tous les refresh tokens du user
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    const expiresAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    return { expiresAt };
  }

  /**
   * Annule la suppression d'un compte. Vérifie credentials manuellement
   * (verifyCredentials rejetterait à cause du deletedAt).
   */
  async cancelDeletion(email: string, password: string): Promise<PublicUser> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw Object.assign(new Error("Invalid credentials"), {
        statusCode: 401, code: "INVALID_CREDENTIALS",
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error("Invalid credentials"), {
        statusCode: 401, code: "INVALID_CREDENTIALS",
      });
    }

    if (!user.deletedAt) {
      throw Object.assign(new Error("Account is not pending deletion"), {
        statusCode: 400, code: "NOT_PENDING_DELETION",
      });
    }

    const graceMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() >= user.deletedAt.getTime() + graceMs) {
      throw Object.assign(new Error("Grace period expired"), {
        statusCode: 410, code: "GRACE_PERIOD_EXPIRED",
      });
    }

    const [updated] = await db.update(users)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    return this.toPublic(updated!);
  }

  // ----------------------------------------------------------
  // [ACCOUNT-PAGE-V1] Met à jour le profil de l'utilisateur.
  // Pour V1, seul `name` est modifiable. L'email reste verrouillé
  // (cf. roadmap auth — changement d'email = nouveau flow vérif).
  // ----------------------------------------------------------
  async updateProfile(
    userId: string,
    data:   { name?: string },
  ): Promise<PublicUser> {
    const updates: Partial<{ name: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };

    if (typeof data.name === "string") {
      const trimmed = data.name.trim();
      if (trimmed.length === 0) {
        throw Object.assign(new Error("Name cannot be empty"), {
          statusCode: 400, code: "INVALID_NAME",
        });
      }
      if (trimmed.length > 100) {
        throw Object.assign(new Error("Name too long"), {
          statusCode: 400, code: "INVALID_NAME",
        });
      }
      updates.name = trimmed;
    }

    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404, code: "USER_NOT_FOUND",
      });
    }

    return this.toPublic(updated);
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
