// ============================================================
// UMAMI-ANALYTICS-V1
// apps/web/src/components/analytics/UmamiAnalytics.tsx
// ------------------------------------------------------------
// Mesure d'audience Umami self-hosted, cookieless et exemptée de
// consentement (CNIL) : aucun cookie, pas de donnée nominative,
// pas de tiers → PAS de bandeau, ~100% du trafic compté.
//
// Servie EN FIRST-PARTY same-origin : le script vient de
// /mz/script.js et la collecte cible /mz/api/send (data-host-url) —
// cf. caddy/Caddyfile (handle_path /mz). Same-origin → couvert par
// la CSP `'self'`, aucune exception à ajouter, et non bloqué par
// les adblockers.
//
// Le tracker auto-suit les pages vues (y compris la navigation SPA
// de l'App Router via l'History API). Les events custom passent par
// window.umami.track(...) (cf. CIEL-CONVERSION-EVENTS-V1 / TrackedCta).
//
// Chargé UNIQUEMENT en production (NODE_ENV) : /mz n'existe qu'en prod
// et on évite de polluer les stats avec le dev local.
// ============================================================

import Script from "next/script";

export const UMAMI_ENABLED = process.env.NODE_ENV === "production";

// Website créé côté Umami (dashboard « llmastro.com »). Non secret.
const UMAMI_WEBSITE_ID = "6a5abe29-8f16-4268-a8a0-5b337ee65f1f";
// Script + collecte servis en first-party sous /mz (Caddy strippe le préfixe).
const UMAMI_SRC = "/mz/script.js";
const UMAMI_HOST_URL = "https://llmastro.com/mz"; // → collecte vers /mz/api/send

declare global {
  interface Window {
    // Exposé par le tracker Umami : suivi d'events custom.
    umami?: {
      track: (
        event?: string | Record<string, unknown>,
        data?: Record<string, unknown>,
      ) => void;
    };
  }
}

export default function UmamiAnalytics() {
  if (!UMAMI_ENABLED) return null;
  return (
    <Script
      src={UMAMI_SRC}
      data-website-id={UMAMI_WEBSITE_ID}
      data-host-url={UMAMI_HOST_URL}
      strategy="afterInteractive"
    />
  );
}

// UMAMI-ANALYTICS-V1 applied
