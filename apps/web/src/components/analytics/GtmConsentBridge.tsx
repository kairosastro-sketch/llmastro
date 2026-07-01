// ============================================================
// ANALYTICS-GTM-V1
// apps/web/src/components/analytics/GtmConsentBridge.tsx
// ------------------------------------------------------------
// Relaie en DIRECT le choix de consentement « mesure d'audience »
// vers Google Consent Mode, sans recharger la page. Le pré-octroi
// des visiteurs récurrents est déjà géré dans le script <head>
// (GtmHeadScripts) ; ce bridge ne traite que les changements en
// cours de session (clic Accepter / Refuser sur le bandeau).
//
// Le bandeau ne demande le consentement que pour l'analytics :
// on ne touche donc qu'à `analytics_storage`. Les stockages
// publicitaires restent `denied` (posés par le default du <head>).
// ============================================================

"use client";

import { useEffect } from "react";
import { CONSENT_EVENT, getConsent } from "@/lib/analytics/consent";
import { GTM_ENABLED } from "./GoogleTagManager";

export default function GtmConsentBridge() {
  useEffect(() => {
    if (!GTM_ENABLED) return;

    const sync = () => {
      const consent = getConsent();
      if (consent === "unset") return; // rien à relayer tant que non tranché
      // Réutilise le gtag() défini par le bootstrap <head> (GtmHeadScripts).
      window.gtag?.("consent", "update", {
        analytics_storage: consent === "granted" ? "granted" : "denied",
      });
    };

    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  return null;
}

// ANALYTICS-GTM-V1 applied
