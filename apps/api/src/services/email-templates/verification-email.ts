// ============================================================
// apps/api/src/services/email-templates/verification-email.ts
// ARCHIVE-AUTH-EMAIL-VERIFY-V1
// ------------------------------------------------------------
// Template HTML + texte pour l'email de vérification au signup.
// Pas de MJML pour V1 : un seul template, inline styles, palette
// soft mystique « Céleste » (deep navy + or + violet), aligné
// sur le ton du dashboard et de PushEnableBanner.
//
// Bilingue FR/EN selon `user.preferences.locale` (default "fr").
// L'URL de vérif pointe vers la page Next /auth/verify-email,
// construite par le service avec APP_URL + token.
// ============================================================

export interface RenderVerificationEmailInput {
  /** Nom affiché en salutation. null = "Bonjour," sans nom. */
  name:      string | null;
  /** URL complète vers la page de vérif (token inclus). */
  verifyUrl: string;
  /** Durée de validité, intégrée au texte. */
  ttlHours:  number;
  /** Langue du destinataire (default "fr"). */
  locale:    "fr" | "en";
}

export function renderVerificationEmail(
  input: RenderVerificationEmailInput,
): { subject: string; html: string; text: string } {
  const isEn = input.locale === "en";

  const greeting = input.name
    ? (isEn ? `Hello ${input.name},` : `Bonjour ${input.name},`)
    : (isEn ? "Hello," : "Bonjour,");

  const subject     = isEn ? "Confirm your email — Llmastro"          : "Confirme ton email — Llmastro";
  const intro       = isEn ? "Welcome to Llmastro. Please confirm your email address to fully activate your account."
                           : "Bienvenue sur Llmastro. Confirme ton adresse e-mail pour activer pleinement ton compte.";
  const cta         = isEn ? "Confirm my email"                       : "Confirmer mon email";
  const expiryNote  = isEn ? `This link expires in ${input.ttlHours} hours.`
                           : `Ce lien expire dans ${input.ttlHours} heures.`;
  const fallback    = isEn ? "If the button doesn't work, paste this link into your browser:"
                           : "Si le bouton ne fonctionne pas, colle ce lien dans ton navigateur :";
  const ignoreLine  = isEn ? "If you didn't create a Llmastro account, you can safely ignore this email."
                           : "Si tu n'as pas créé de compte Llmastro, tu peux ignorer cet email en toute tranquillité.";
  const signature   = isEn ? "— The Llmastro team"                    : "— L'équipe Llmastro";

  // Palette inline ("Céleste") — pas de var(--*) côté email (les
  // clients mail ne supportent pas les CSS custom properties).
  const html = `<!doctype html>
<html lang="${isEn ? "en" : "fr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0d0d15;font-family:Georgia,'Times New Roman',serif;color:#e8e6f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d15;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#15151f;border:1px solid #2a2740;border-radius:14px;">
            <tr>
              <td style="padding:36px 32px;">
                <div style="text-align:center;margin-bottom:8px;">
                  <span style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;border:1px solid #2a2740;color:#d4af6a;font-size:22px;text-align:center;">&#x2726;</span>
                </div>
                <h1 style="text-align:center;font-size:24px;font-weight:400;margin:14px 0 28px;color:#e8e6f0;letter-spacing:0.04em;">Llmastro</h1>

                <p style="font-size:15px;line-height:1.6;margin:0 0 12px;color:#e8e6f0;">${escapeHtml(greeting)}</p>
                <p style="font-size:15px;line-height:1.6;margin:0 0 28px;color:#bdb8d0;">${escapeHtml(intro)}</p>

                <div style="text-align:center;margin:0 0 24px;">
                  <a href="${escapeAttr(input.verifyUrl)}" style="display:inline-block;padding:13px 30px;background:#d4af6a;color:#0d0d15;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;letter-spacing:0.03em;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(cta)}</a>
                </div>

                <p style="font-size:12px;line-height:1.6;color:#8a85a0;margin:0 0 14px;">${escapeHtml(expiryNote)}</p>
                <p style="font-size:12px;line-height:1.6;color:#8a85a0;margin:0 0 6px;">${escapeHtml(fallback)}</p>
                <p style="font-size:12px;line-height:1.6;margin:0 0 24px;"><a href="${escapeAttr(input.verifyUrl)}" style="color:#a89cd9;word-break:break-all;text-decoration:underline;">${escapeHtml(input.verifyUrl)}</a></p>

                <hr style="border:none;border-top:1px solid #2a2740;margin:24px 0;" />
                <p style="font-size:12px;line-height:1.6;color:#8a85a0;margin:0 0 14px;font-style:italic;">${escapeHtml(ignoreLine)}</p>
                <p style="font-size:13px;line-height:1.6;color:#8a85a0;margin:0;font-style:italic;">${escapeHtml(signature)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    greeting,
    "",
    intro,
    "",
    `${cta}: ${input.verifyUrl}`,
    "",
    expiryNote,
    "",
    ignoreLine,
    "",
    signature,
  ].join("\n");

  return { subject, html, text };
}

// Échappement minimal : on contrôle le `name` (validé au signup, varchar 100)
// et `verifyUrl` (construit par nous), donc le risque XSS via template est
// nul en pratique — mais on échappe quand même par défense en profondeur,
// au cas où le pipeline change (par ex. resend de l'email avec un nom OAuth
// brut, qui pourrait contenir des caractères inattendus).
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

// ARCHIVE-AUTH-EMAIL-VERIFY-V1 applied
