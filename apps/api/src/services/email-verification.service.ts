// ============================================================
// apps/api/src/services/email-verification.service.ts
// ARCHIVE-AUTH-EMAIL-VERIFY-V1
// ------------------------------------------------------------
// Génère, envoie et consomme les tokens de vérif d'email.
//
// Sécurité :
//   - token raw (32 bytes base64url ≈ 256 bits d'entropie)
//     envoyé dans l'email uniquement ;
//   - seul son sha256 est stocké en DB (même pattern que
//     refresh_tokens, cf. auth.service.storeRefreshToken).
//   - TTL 24h (décision UX, cf. AUTH-EMAIL-VERIFY discussion).
//   - one-shot : `used_at` non-NULL → token rejeté ;
//   - verify() atomique (transaction) : token marqué used +
//     user.email_verified = true en une seule TX.
//
// Caller pattern signup : .catch(swallow) — un Resend down ne
// doit pas faire échouer le /auth/register (cf. mailer.ts).
// ============================================================

import crypto from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, emailVerificationTokens } from "../db/schema.js";
import { sendEmail, isMailerConfigured } from "./mailer.js";
import { userPreferencesService } from "./user-preferences.service.js";
import { renderVerificationEmail } from "./email-templates/verification-email.js";

const TOKEN_TTL_HOURS = 24;
const TOKEN_BYTES = 32;

interface LoggerLike {
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

export class EmailVerificationService {

  /**
   * Génère un token et envoie l'email. No-op si user déjà vérifié
   * ou si le mailer n'est pas configuré (dev local sans clé Resend).
   *
   * Erreurs réseau Resend : propagées au caller (qui décide de
   * swallow ou pas). Le caller signup wrap dans .catch().
   */
  async sendForUser(userId: string, opts: { logger?: LoggerLike } = {}): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404, code: "USER_NOT_FOUND",
      });
    }
    if (user.emailVerified) {
      opts.logger?.info?.({ userId }, "[email-verification] user already verified — skip");
      return;
    }
    if (!isMailerConfigured()) {
      opts.logger?.warn?.({ userId }, "[email-verification] RESEND_API_KEY missing — skip send (dev mode?)");
      return;
    }

    const tokenRaw  = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(tokenRaw).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const prefs   = await userPreferencesService.get(user.id);
    const locale  = prefs.locale === "en" ? "en" : "fr";
    const appUrl  = process.env["APP_URL"] ?? "http://localhost:3000";
    const verifyUrl = `${appUrl}/auth/verify-email?token=${encodeURIComponent(tokenRaw)}`;

    const { subject, html, text } = renderVerificationEmail({
      name:      user.name,
      verifyUrl,
      ttlHours:  TOKEN_TTL_HOURS,
      locale,
    });

    const res = await sendEmail({ to: user.email, subject, html, text });
    opts.logger?.info?.({ userId, resendId: res.id }, "[email-verification] email sent");
  }

  /**
   * Consomme un token raw. Atomique : token.used_at + user.email_verified.
   * Idempotent : si user déjà vérifié, succès silencieux (le token
   * peut être consommé une seule fois quand même).
   */
  async verify(rawToken: string): Promise<{ userId: string; alreadyVerified: boolean }> {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length < 8) {
      throw Object.assign(new Error("Invalid token"), {
        statusCode: 400, code: "INVALID_TOKEN",
      });
    }
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const [row] = await db
      .select()
      .from(emailVerificationTokens)
      .where(and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ))
      .limit(1);

    if (!row) {
      throw Object.assign(new Error("Token invalid or expired"), {
        statusCode: 400, code: "INVALID_OR_EXPIRED_TOKEN",
      });
    }

    const [user] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);

    if (!user) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404, code: "USER_NOT_FOUND",
      });
    }

    const alreadyVerified = user.emailVerified;

    await db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(eq(emailVerificationTokens.id, row.id));

      if (!alreadyVerified) {
        await tx
          .update(users)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, row.userId));
      }
    });

    return { userId: row.userId, alreadyVerified };
  }
}

export const emailVerificationService = new EmailVerificationService();

// ARCHIVE-AUTH-EMAIL-VERIFY-V1 applied
