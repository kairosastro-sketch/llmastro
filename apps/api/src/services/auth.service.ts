import { eq, and, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";
import type { User } from "../db/schema.js";

// [ACCOUNT-DELETE-V1] Période de grâce pour annuler la suppression d'un compte.
const GRACE_PERIOD_DAYS = 30;

// [OAUTH-GOOGLE-FACEBOOK-V1] Lit une variable d'env requise pour OAuth.
// Throw une erreur 500 explicite si manquante — évite un échec opaque
// au milieu du flow OAuth.
function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw Object.assign(new Error(`Missing required env var: ${key}`), {
      statusCode: 500, code: "OAUTH_CONFIG_MISSING",
    });
  }
  return v;
}

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

  // ----------------------------------------------------------
  // OAUTH-GOOGLE-FACEBOOK-V1 — Google + Facebook OAuth
  // ----------------------------------------------------------
  // Flow standard authorization-code :
  //   1. /auth/{provider}        → redirect vers authorize URL (state CSRF)
  //   2. provider                → redirect vers callback URL avec ?code=…
  //   3. /auth/{provider}/callback → échange code contre access_token,
  //                                   fetch userinfo, upsert user,
  //                                   issue nos propres JWT.
  //
  // Politique de linking (cf. choix produit 2026-05-23) :
  //   - Si (provider, provider_id) déjà connu → login direct.
  //   - Sinon si email déjà présent ET fournisseur l'a vérifié →
  //     LINK : on attache l'identité OAuth au compte existant
  //     (UPDATE provider+provider_id+avatar_url). Standard Auth0/Clerk.
  //   - Sinon → INSERT nouveau user (provider non-local, sans password).
  //
  // ACCOUNT_DELETION_PENDING : le check est appliqué dans upsert
  // pour rejeter aussi les logins OAuth d'un compte en grâce.
  // ----------------------------------------------------------

  getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id:     process.env["GOOGLE_CLIENT_ID"] ?? "",
      redirect_uri:  process.env["GOOGLE_CALLBACK_URL"] ?? "",
      response_type: "code",
      scope:         "openid email profile",
      state,
      access_type:   "online",
      prompt:        "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  getFacebookAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id:     process.env["FACEBOOK_CLIENT_ID"] ?? "",
      redirect_uri:  process.env["FACEBOOK_CALLBACK_URL"] ?? "",
      response_type: "code",
      scope:         "email,public_profile",
      state,
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string): Promise<{ user: PublicUser; isNewUser: boolean }> {
    const clientId     = requireEnv("GOOGLE_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
    const redirectUri  = requireEnv("GOOGLE_CALLBACK_URL");

    // 1) Code → access_token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }).toString(),
    });
    if (!tokenRes.ok) {
      throw Object.assign(new Error(`Google token exchange failed (${tokenRes.status})`), {
        statusCode: 502, code: "OAUTH_TOKEN_EXCHANGE_FAILED",
      });
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw Object.assign(new Error("Google token response missing access_token"), {
        statusCode: 502, code: "OAUTH_TOKEN_EXCHANGE_FAILED",
      });
    }

    // 2) Access token → userinfo
    const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userRes.ok) {
      throw Object.assign(new Error(`Google userinfo failed (${userRes.status})`), {
        statusCode: 502, code: "OAUTH_USERINFO_FAILED",
      });
    }
    const profile = (await userRes.json()) as {
      sub:            string;
      email?:         string;
      email_verified?: boolean;
      name?:          string;
      picture?:       string;
    };
    if (!profile.email) {
      throw Object.assign(new Error("Google account has no email"), {
        statusCode: 400, code: "OAUTH_NO_EMAIL",
      });
    }

    return this.upsertOAuthUser({
      provider:      "google",
      providerId:    profile.sub,
      email:         profile.email,
      emailVerified: profile.email_verified === true,
      name:          profile.name ?? null,
      avatarUrl:     profile.picture ?? null,
    });
  }

  async handleFacebookCallback(code: string): Promise<{ user: PublicUser; isNewUser: boolean }> {
    const clientId     = requireEnv("FACEBOOK_CLIENT_ID");
    const clientSecret = requireEnv("FACEBOOK_CLIENT_SECRET");
    const redirectUri  = requireEnv("FACEBOOK_CALLBACK_URL");

    // 1) Code → access_token (Facebook accepte GET pour cet endpoint)
    const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id",     clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri",  redirectUri);
    tokenUrl.searchParams.set("code",          code);

    const tokenRes = await fetch(tokenUrl.toString());
    if (!tokenRes.ok) {
      throw Object.assign(new Error(`Facebook token exchange failed (${tokenRes.status})`), {
        statusCode: 502, code: "OAUTH_TOKEN_EXCHANGE_FAILED",
      });
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw Object.assign(new Error("Facebook token response missing access_token"), {
        statusCode: 502, code: "OAUTH_TOKEN_EXCHANGE_FAILED",
      });
    }

    // 2) Access token → userinfo (Graph API)
    // Note : Facebook ne retourne `email` que si l'utilisateur l'a vérifié
    // (et a accordé la permission email). La présence = vérification.
    const userUrl = new URL("https://graph.facebook.com/me");
    userUrl.searchParams.set("fields",       "id,email,name,picture.type(large)");
    userUrl.searchParams.set("access_token", tokenJson.access_token);

    const userRes = await fetch(userUrl.toString());
    if (!userRes.ok) {
      throw Object.assign(new Error(`Facebook userinfo failed (${userRes.status})`), {
        statusCode: 502, code: "OAUTH_USERINFO_FAILED",
      });
    }
    const profile = (await userRes.json()) as {
      id:      string;
      email?:  string;
      name?:   string;
      picture?: { data?: { url?: string } };
    };
    if (!profile.email) {
      throw Object.assign(new Error("Facebook account has no email or permission was denied"), {
        statusCode: 400, code: "OAUTH_NO_EMAIL",
      });
    }

    return this.upsertOAuthUser({
      provider:      "facebook",
      providerId:    profile.id,
      email:         profile.email,
      emailVerified: true,  // Facebook ne renvoie l'email que vérifié
      name:          profile.name ?? null,
      avatarUrl:     profile.picture?.data?.url ?? null,
    });
  }

  /**
   * Upsert d'un user via OAuth.
   *   1. Si déjà connu par (provider, providerId) → return (login).
   *   2. Sinon si email déjà utilisé ET provider l'a vérifié → link.
   *   3. Sinon insert.
   * Refuse les comptes en grâce de suppression (ACCOUNT_DELETION_PENDING).
   */
  private async upsertOAuthUser(input: {
    provider:      string;
    providerId:    string;
    email:         string;
    emailVerified: boolean;
    name:          string | null;
    avatarUrl:     string | null;
  }): Promise<{ user: PublicUser; isNewUser: boolean }> {
    const normalizedEmail = input.email.toLowerCase();
    const now = new Date();

    // 1) Lookup par (provider, providerId) — identité OAuth déjà liée
    const [byProvider] = await db
      .select()
      .from(users)
      .where(and(eq(users.provider, input.provider), eq(users.providerId, input.providerId)))
      .limit(1);

    if (byProvider) {
      this.assertNotDeletionPending(byProvider);
      // Refresh des champs profil (avatar, nom) qui peuvent changer côté provider
      const [refreshed] = await db.update(users)
        .set({
          name:      byProvider.name ?? input.name,
          avatarUrl: input.avatarUrl ?? byProvider.avatarUrl,
          updatedAt: now,
        })
        .where(eq(users.id, byProvider.id))
        .returning();
      return { user: this.toPublic(refreshed!), isNewUser: false };
    }

    // 2) Lookup par email — éventuel linking
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (byEmail) {
      this.assertNotDeletionPending(byEmail);

      if (!input.emailVerified) {
        // Email pris mais le provider OAuth ne garantit pas qu'il appartient
        // au porteur. Refus pour éviter un takeover.
        throw Object.assign(new Error("Email already in use — log in with your existing method to link"), {
          statusCode: 409, code: "OAUTH_EMAIL_ALREADY_USED",
        });
      }

      const [linked] = await db.update(users)
        .set({
          provider:   input.provider,
          providerId: input.providerId,
          avatarUrl:  byEmail.avatarUrl ?? input.avatarUrl,
          // emailVerified passe à true si on a lié un email vérifié par l'IDP
          emailVerified: byEmail.emailVerified || input.emailVerified,
          updatedAt:  now,
        })
        .where(eq(users.id, byEmail.id))
        .returning();
      return { user: this.toPublic(linked!), isNewUser: false };
    }

    // 3) Nouveau user — pas de passwordHash (provider OAuth uniquement)
    const [created] = await db.insert(users).values({
      email:         normalizedEmail,
      name:          input.name,
      avatarUrl:     input.avatarUrl,
      provider:      input.provider,
      providerId:    input.providerId,
      emailVerified: input.emailVerified,
    }).returning();

    return { user: this.toPublic(created!), isNewUser: true };
  }

  private assertNotDeletionPending(user: User): void {
    if (!user.deletedAt) return;
    const graceMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(user.deletedAt.getTime() + graceMs);
    if (Date.now() < expiresAt.getTime()) {
      throw Object.assign(new Error("Account deletion pending"), {
        statusCode: 403,
        code:       "ACCOUNT_DELETION_PENDING",
        details:    { expiresAt: expiresAt.toISOString() },
      });
    }
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
