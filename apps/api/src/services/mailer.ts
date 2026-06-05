// ============================================================
// apps/api/src/services/mailer.ts
// ARCHIVE-AUTH-EMAIL-VERIFY-V1
// ------------------------------------------------------------
// Wrapper Resend partagé. Premier consommateur : email-verification.
// Phase 2 (email digest des notifs) réutilisera sendEmail().
//
// Init lazy : on lit RESEND_API_KEY au premier appel, pas au
// boot. Permet de ne pas forcer la config Resend en dev local
// (l'API démarre, juste les envois sont skipped).
//
// EMAIL_FROM doit être un sender vérifié côté Resend, sinon
// l'API renvoie 422. Le DNS du domaine (SPF, DKIM, DMARC) est
// géré côté registrar — pas du ressort du code.
// ============================================================

import { Resend } from "resend";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey) return null;
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]?.trim());
}

export interface SendEmailInput {
  to:       string;
  subject:  string;
  html:     string;
  text:     string;
  /** Optionnel : adresse de réponse (ex. formulaire de contact). */
  replyTo?: string;
}

/**
 * Envoie un email transactionnel. Throw avec code applicatif
 * lisible par l'error handler global (ERROR-SHAPE-V1).
 *
 * Caller pattern : pour les envois non-bloquants (signup), wrap
 * dans .catch() pour swallow l'erreur — sinon un Resend down
 * ferait échouer le signup, ce qu'on ne veut pas.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string | null }> {
  const client = getClient();
  if (!client) {
    throw Object.assign(new Error("Mailer not configured (RESEND_API_KEY missing)"), {
      statusCode: 503, code: "MAILER_NOT_CONFIGURED",
    });
  }
  const from = process.env["EMAIL_FROM"]?.trim();
  if (!from) {
    throw Object.assign(new Error("EMAIL_FROM env var is required"), {
      statusCode: 500, code: "MAILER_FROM_MISSING",
    });
  }

  const res = await client.emails.send({
    from,
    to:      input.to,
    subject: input.subject,
    html:    input.html,
    text:    input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });

  if (res.error) {
    throw Object.assign(new Error(`Resend error: ${res.error.message}`), {
      statusCode: 502, code: "MAILER_SEND_FAILED",
      details:    { providerError: res.error.name },
    });
  }

  return { id: res.data?.id ?? null };
}

// ARCHIVE-AUTH-EMAIL-VERIFY-V1 applied
