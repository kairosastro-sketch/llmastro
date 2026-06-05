// ============================================================
// CONTACT-FORM-V1 — apps/api/src/routes/contact.ts
// ------------------------------------------------------------
// Route publique POST /contact : reçoit un message du formulaire
// de contact (page /contact côté web) et le relaie par email via
// Resend (mailer.ts) vers la boîte CONTACT_INBOX.
//
// - Sans auth, rate-limité (anti-spam basique : 5/h/IP).
// - Honeypot `website` : si rempli, on répond 200 sans rien faire
//   (on ne donne aucun signal au bot).
// - reply_to pointe sur l'expéditeur pour qu'un simple « Répondre »
//   depuis la boîte revienne à l'utilisateur.
// - Si le mailer n'est pas configuré (RESEND_API_KEY vide en dev),
//   sendEmail throw MAILER_NOT_CONFIGURED → 503, géré par l'error
//   handler global (ERROR-SHAPE-V1).
// ============================================================

import type { FastifyPluginAsync } from "fastify";
import { sendEmail } from "../services/mailer.js";

const CONTACT_INBOX = "info@llmastro.com";

const contactSchema = {
  body: {
    type: "object",
    required: ["name", "email", "message"],
    properties: {
      name:    { type: "string", minLength: 2,  maxLength: 100 },
      email:   { type: "string", format: "email", maxLength: 255 },
      subject: { type: "string", maxLength: 200 },
      message: { type: "string", minLength: 10, maxLength: 5000 },
      // Honeypot : champ invisible côté UI, doit rester vide.
      website: { type: "string", maxLength: 0 },
    },
    additionalProperties: false,
  },
} as const;

interface ContactBody {
  name:     string;
  email:    string;
  subject?: string;
  message:  string;
  website?: string;
}

export const contactRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ContactBody }>(
    "/",
    {
      schema: { ...contactSchema, tags: ["contact"] },
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      // Honeypot rempli → bot. On répond OK sans envoyer.
      if (req.body.website && req.body.website.length > 0) {
        return reply.send({ success: true, data: { sent: true } });
      }

      const name    = req.body.name.trim();
      const email   = req.body.email.trim();
      const subject = req.body.subject?.trim() || "(sans objet)";
      const message = req.body.message.trim();

      const inbox = process.env["CONTACT_INBOX"]?.trim() || CONTACT_INBOX;

      const text = [
        `Nouveau message depuis le formulaire de contact Llmastro`,
        ``,
        `Nom    : ${name}`,
        `Email  : ${email}`,
        `Objet  : ${subject}`,
        ``,
        `Message :`,
        message,
      ].join("\n");

      const html = `<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8" /></head>
  <body style="margin:0;padding:0;background:#0d0d15;font-family:Georgia,'Times New Roman',serif;color:#e8e6f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d15;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#15151f;border:1px solid #2a2740;border-radius:14px;">
            <tr>
              <td style="padding:32px;">
                <h1 style="font-size:20px;font-weight:400;margin:0 0 24px;color:#d4af6a;letter-spacing:0.03em;">✦ Nouveau message — Contact Llmastro</h1>
                <p style="font-size:14px;line-height:1.7;margin:0 0 8px;color:#bdb8d0;"><strong style="color:#e8e6f0;">Nom :</strong> ${escapeHtml(name)}</p>
                <p style="font-size:14px;line-height:1.7;margin:0 0 8px;color:#bdb8d0;"><strong style="color:#e8e6f0;">Email :</strong> <a href="mailto:${escapeAttr(email)}" style="color:#a89cd9;">${escapeHtml(email)}</a></p>
                <p style="font-size:14px;line-height:1.7;margin:0 0 20px;color:#bdb8d0;"><strong style="color:#e8e6f0;">Objet :</strong> ${escapeHtml(subject)}</p>
                <hr style="border:none;border-top:1px solid #2a2740;margin:20px 0;" />
                <p style="font-size:15px;line-height:1.7;margin:0;color:#e8e6f0;white-space:pre-wrap;">${escapeHtml(message)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

      await sendEmail({
        to:      inbox,
        subject: `[Contact] ${subject} — ${name}`,
        html,
        text,
        replyTo: email,
      });

      return reply.send({ success: true, data: { sent: true } });
    },
  );
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// CONTACT-FORM-V1 applied
