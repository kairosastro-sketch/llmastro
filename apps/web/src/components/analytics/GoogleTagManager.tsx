// ============================================================
// ANALYTICS-GTM-V1
// apps/web/src/components/analytics/GoogleTagManager.tsx
// ------------------------------------------------------------
// Google Tag Manager (container GTM-MRHKGD59) + Google Consent
// Mode v2, câblé sur le bandeau de consentement « mesure
// d'audience » existant (cf. lib/analytics/consent).
//
//  - Par défaut TOUT est `denied` : GTM se charge mais GA4
//    n'écrit aucun cookie et n'envoie que des pings sans
//    identifiant (comportement Consent Mode « denied »).
//  - Le bandeau ne demande le consentement QUE pour la mesure
//    d'audience → on ne débloque que `analytics_storage`. Les
//    stockages publicitaires (`ad_*`) restent toujours `denied`.
//  - Visiteur récurrent ayant déjà accepté : le pré-octroi se
//    fait dans le script <head> (avant le chargement de GTM),
//    pour tracker dès la 1ʳᵉ page vue.
//  - Choix en cours de session (clic Accepter/Refuser) : relayé
//    en direct par <GtmConsentBridge/> via l'event de consentement.
//
// ⚠️ CSP : les domaines googletagmanager.com / google-analytics.com
// doivent être autorisés dans caddy/Caddyfile (SECURITY-CSP-GTM-V1).
//
// Ne charge qu'en production (évite de polluer la propriété GA
// avec le trafic de dev local ; le stack Docker prod-like et la
// prod tournent en NODE_ENV=production).
// ============================================================

import { CONSENT_STORAGE_KEY } from "@/lib/analytics/consent";

export const GTM_ID = "GTM-MRHKGD59";
export const GTM_ENABLED = process.env.NODE_ENV === "production";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// ── Scripts <head> : Consent Mode (default denied) + loader GTM.
//    Rendu tel quel dans le <head> du RootLayout, le plus haut
//    possible et AVANT toute autre analytics.
export function GtmHeadScripts() {
  if (!GTM_ENABLED) return null;

  // 1) dataLayer + gtag + consent default (denied), puis pré-octroi
  //    de `analytics_storage` si l'utilisateur a déjà accepté.
  const consentBootstrap = `
(function(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent','default',{
    ad_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied',
    analytics_storage:'denied',
    wait_for_update: 500
  });
  try {
    if (localStorage.getItem('${CONSENT_STORAGE_KEY}') === 'granted') {
      gtag('consent','update',{ analytics_storage:'granted' });
    }
  } catch(e){}
})();`;

  // 2) Loader officiel GTM (snippet standard).
  const gtmLoader = `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: consentBootstrap }} />
      <script dangerouslySetInnerHTML={{ __html: gtmLoader }} />
    </>
  );
}

// ── <noscript> : iframe GTM standard (fallback JS désactivé).
//    Rendu au tout début du <body>.
export function GtmNoScript() {
  if (!GTM_ENABLED) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="gtm"
      />
    </noscript>
  );
}

// ANALYTICS-GTM-V1 applied
