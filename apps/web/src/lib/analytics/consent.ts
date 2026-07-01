// ============================================================
// ANALYTICS-V1
// apps/web/src/lib/analytics/consent.ts
// ------------------------------------------------------------
// État de consentement « mesure d'audience » (RGPD), stocké en
// localStorage. Tant que le choix n'est pas "granted", aucun
// beacon analytics n'est émis et aucun cookie `aid` n'est posé.
// ============================================================

export type ConsentValue = "granted" | "denied" | "unset";

// Clé localStorage du consentement « mesure d'audience ». Exportée
// car réutilisée par le bootstrap Consent Mode de GTM (ANALYTICS-GTM-V1)
// qui lit ce même flag AVANT le chargement du container.
export const CONSENT_STORAGE_KEY = "astro_consent_analytics";
const KEY = CONSENT_STORAGE_KEY;
export const CONSENT_EVENT = "astro:consent-changed";

export function getConsent(): ConsentValue {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}

export function setConsent(value: Exclude<ConsentValue, "unset">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* localStorage indisponible (mode privé strict) : on ignore */
  }
  // Notifie le tracker (et la bannière) sans recharger la page.
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "granted";
}

// ANALYTICS-V1 applied
