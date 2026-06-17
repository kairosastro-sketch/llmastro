// ============================================================
// apps/api/src/services/email-templates/subscription-welcome-email.ts
// STRIPE-WELCOME-EMAIL-V1
// ------------------------------------------------------------
// Template HTML + texte de l'email de bienvenue envoyé après une
// souscription réussie (webhook checkout.session.completed).
// Même charte « Céleste » (deep navy + or + violet) et même
// structure inline-styles que verification-email.ts — les clients
// mail ne supportent ni var(--*) ni feuilles externes.
//
// Bilingue FR/EN selon la préférence locale du destinataire.
// On rappelle que le produit est en première version et qu'on
// accueille tous les retours (lien contact), en cohérence avec la
// page /subscriptions/success.
// ============================================================

export interface RenderSubscriptionWelcomeEmailInput {
  /** Nom affiché en salutation. null = "Bonjour," sans nom. */
  name:         string | null;
  /** Nom lisible du plan souscrit (ex. "Essentiel"). */
  planName:     string;
  /** URL absolue vers le dashboard. */
  dashboardUrl: string;
  /** URL absolue vers la page de gestion de l'abonnement. */
  manageUrl:    string;
  /** URL absolue vers la page contact (retours). */
  contactUrl:   string;
  /** Langue du destinataire (default "fr"). */
  locale:       "fr" | "en";
}

export function renderSubscriptionWelcomeEmail(
  input: RenderSubscriptionWelcomeEmailInput,
): { subject: string; html: string; text: string } {
  const isEn = input.locale === "en";

  const greeting = input.name
    ? (isEn ? `Hello ${input.name},` : `Bonjour ${input.name},`)
    : (isEn ? "Hello," : "Bonjour,");

  const subject = isEn
    ? `Welcome to ${input.planName} — Llmastro`
    : `Bienvenue sur ${input.planName} — Llmastro`;
  const title = isEn
    ? `Welcome to ${input.planName} ✦`
    : `Bienvenue sur ${input.planName} ✦`;
  const intro = isEn
    ? "Your subscription is active and all your new accesses are unlocked. Your chart, your readings and Kairos are waiting for you."
    : "Ton abonnement est actif et tous tes nouveaux accès sont débloqués. Ton thème, tes lectures et Kairos t'attendent.";
  const ctaDash   = isEn ? "Go to my dashboard"   : "Aller à mon dashboard";
  const ctaManage = isEn ? "Manage my subscription" : "Gérer mon abonnement";

  // Disclaimer « première version » + invitation aux retours, aligné
  // sur la page de remerciement.
  const betaNote = isEn
    ? "Llmastro is in its first version: a few bugs may still slip through. Every piece of feedback is welcome and read carefully — it directly shapes what comes next."
    : "Llmastro en est à sa première version : quelques bugs peuvent encore se glisser. Tous tes retours sont les bienvenus et lus attentivement — ils façonnent directement la suite.";
  const contactCta = isEn ? "Share your feedback" : "Partager un retour";

  const signature = isEn ? "— The Llmastro team" : "— L'équipe Llmastro";

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
                <h1 style="text-align:center;font-size:24px;font-weight:400;margin:14px 0 6px;color:#e8e6f0;letter-spacing:0.04em;">Llmastro</h1>
                <p style="text-align:center;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#d4af6a;margin:0 0 26px;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(isEn ? "Subscription confirmed" : "Abonnement confirmé")}</p>

                <h2 style="text-align:center;font-size:20px;font-weight:400;margin:0 0 18px;color:#e8e6f0;">${escapeHtml(title)}</h2>

                <p style="font-size:15px;line-height:1.6;margin:0 0 12px;color:#e8e6f0;">${escapeHtml(greeting)}</p>
                <p style="font-size:15px;line-height:1.6;margin:0 0 28px;color:#bdb8d0;">${escapeHtml(intro)}</p>

                <div style="text-align:center;margin:0 0 14px;">
                  <a href="${escapeAttr(input.dashboardUrl)}" style="display:inline-block;padding:13px 30px;background:#d4af6a;color:#0d0d15;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;letter-spacing:0.03em;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(ctaDash)}</a>
                </div>
                <div style="text-align:center;margin:0 0 28px;">
                  <a href="${escapeAttr(input.manageUrl)}" style="font-size:13px;color:#a89cd9;text-decoration:underline;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(ctaManage)}</a>
                </div>

                <hr style="border:none;border-top:1px solid #2a2740;margin:24px 0;" />

                <p style="font-size:13px;line-height:1.6;color:#bdb8d0;margin:0 0 14px;">${escapeHtml(betaNote)}</p>
                <div style="text-align:center;margin:0 0 8px;">
                  <a href="${escapeAttr(input.contactUrl)}" style="font-size:13px;color:#a89cd9;text-decoration:underline;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(contactCta)}</a>
                </div>

                <hr style="border:none;border-top:1px solid #2a2740;margin:24px 0;" />
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
    `${ctaDash}: ${input.dashboardUrl}`,
    `${ctaManage}: ${input.manageUrl}`,
    "",
    betaNote,
    `${contactCta}: ${input.contactUrl}`,
    "",
    signature,
  ].join("\n");

  return { subject, html, text };
}

// Échappement minimal (défense en profondeur) — mêmes helpers que
// verification-email.ts. name vient de la DB (varchar 100), planName et
// URLs sont construits par nous.
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

// STRIPE-WELCOME-EMAIL-V1 applied
