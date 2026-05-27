// ============================================================
// apps/api/src/services/password-reset.service.ts
// AUTH-PASSWORD-RECOVERY-V1
// ------------------------------------------------------------
// Génère, envoie et consomme les tokens « mot de passe oublié »,
// + change-password authentifié.
//
// Sécurité :
//   - token raw (32 bytes base64url ≈ 256 bits d'entropie),
//     envoyé dans l'email uniquement ;
//   - seul son sha256 est stocké en DB (pattern miroir des
//     refresh_tokens / email_verification_tokens) ;
//   - TTL court (1h) : porteur d'un changement d'identifiant ;
//   - one-shot : `used_at` non-NULL → token rejeté ;
//   - request() ne révèle JAMAIS si l'email existe (anti-enum) :
//     même réponse en cas d'email inconnu ou existant ;
//   - reset() révoque tous les refresh_tokens du user pour forcer
//     une reconnexion partout (failure mode safe : si le compte
//     était compromis, on coupe immédiatement les sessions).
//
// OAuth users (provider != "local", passwordHash NULL) : autorisés
// à définir un mot de passe via reset (décision produit — standard
// Auth0/Clerk). Le user peut ensuite se connecter en email/mdp ;
// son provider d'origine reste actif côté `users.provider` jusqu'au
// prochain login OAuth qui le confirmera.
// ============================================================

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, passwordResetTokens, refreshTokens } from "../db/schema.js";
import { sendEmail, isMailerConfigured } from "./mailer.js";
import { userPreferencesService } from "./user-preferences.service.js";
import { renderPasswordResetEmail } from "./email-templates/password-reset-email.js";

const TOKEN_TTL_HOURS = 1;
const TOKEN_BYTES = 32;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const BCRYPT_ROUNDS = 12;

interface LoggerLike {
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

export class PasswordResetService {

  /**
   * Démarre un flow reset. Ne révèle JAMAIS si l'email existe :
   * en cas d'email inconnu / compte supprimé / mailer down, on
   * retourne silencieusement (la route répond toujours 200 avec
   * le même message générique).
   */
  async requestReset(email: string, opts: { logger?: LoggerLike } = {}): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, normalized), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      opts.logger?.info?.({ email: normalized }, "[password-reset] unknown email — silent no-op (anti-enum)");
      return;
    }
    if (!isMailerConfigured()) {
      opts.logger?.warn?.({ userId: user.id }, "[password-reset] RESEND_API_KEY missing — skip send (dev mode?)");
      return;
    }

    const tokenRaw  = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(tokenRaw).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const prefs    = await userPreferencesService.get(user.id);
    const locale   = prefs.locale === "en" ? "en" : "fr";
    const appUrl   = process.env["APP_URL"] ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(tokenRaw)}`;

    const { subject, html, text } = renderPasswordResetEmail({
      name:     user.name,
      resetUrl,
      ttlHours: TOKEN_TTL_HOURS,
      locale,
    });

    const res = await sendEmail({ to: user.email, subject, html, text });
    opts.logger?.info?.({ userId: user.id, resendId: res.id }, "[password-reset] email sent");
  }

  /**
   * Consomme un token raw + applique le nouveau mot de passe.
   * Atomique (TX) : token.used_at + user.password_hash dans la
   * même transaction. Ensuite, révoque TOUS les refresh tokens
   * du user (force re-login partout — failure-safe si compromis).
   */
  async resetWithToken(rawToken: string, newPassword: string): Promise<{ userId: string }> {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length < 8) {
      throw Object.assign(new Error("Invalid token"), {
        statusCode: 400, code: "INVALID_TOKEN",
      });
    }
    this.assertPasswordPolicy(newPassword);

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ))
      .limit(1);

    if (!row) {
      throw Object.assign(new Error("Token invalid or expired"), {
        statusCode: 400, code: "INVALID_OR_EXPIRED_TOKEN",
      });
    }

    const [user] = await db
      .select({ id: users.id, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);

    if (!user || user.deletedAt) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404, code: "USER_NOT_FOUND",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, row.id));

      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, row.userId));
    });

    // Hors-TX : on coupe toutes les sessions (DELETE non-bloquant pour la
    // sécurité du reset lui-même — si ça échoue, on log mais l'opération
    // critique est déjà commit).
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, row.userId));

    return { userId: row.userId };
  }

  /**
   * Change-password authentifié (depuis /dashboard/account).
   * Vérifie le mot de passe actuel avant d'appliquer le nouveau.
   * Pour les comptes OAuth sans passwordHash : refuse, l'user doit
   * passer par le flow « mot de passe oublié » pour en définir un
   * (on ne valide pas un current absent → pas de bypass possible).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!currentPassword || typeof currentPassword !== "string") {
      throw Object.assign(new Error("Current password required"), {
        statusCode: 400, code: "CURRENT_PASSWORD_REQUIRED",
      });
    }
    this.assertPasswordPolicy(newPassword);

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

    if (!user.passwordHash) {
      // Compte OAuth sans mot de passe local. On refuse explicitement
      // pour orienter le user vers le flow forgot-password (qui n'exige
      // pas de mdp actuel).
      throw Object.assign(new Error("No local password set — use password recovery to create one"), {
        statusCode: 409, code: "NO_LOCAL_PASSWORD",
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error("Current password incorrect"), {
        statusCode: 401, code: "INVALID_CURRENT_PASSWORD",
      });
    }

    // Refus du no-op : éviter qu'un user recycle le même mdp par erreur.
    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) {
      throw Object.assign(new Error("New password must differ from current"), {
        statusCode: 400, code: "PASSWORD_UNCHANGED",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  private assertPasswordPolicy(password: string): void {
    if (typeof password !== "string") {
      throw Object.assign(new Error("Password required"), {
        statusCode: 400, code: "INVALID_PASSWORD",
      });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw Object.assign(new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`), {
        statusCode: 400, code: "PASSWORD_TOO_SHORT",
      });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw Object.assign(new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`), {
        statusCode: 400, code: "PASSWORD_TOO_LONG",
      });
    }
  }
}

export const passwordResetService = new PasswordResetService();

// AUTH-PASSWORD-RECOVERY-V1 applied
