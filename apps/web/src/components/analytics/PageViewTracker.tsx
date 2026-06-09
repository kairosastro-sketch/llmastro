// ============================================================
// ANALYTICS-V1
// apps/web/src/components/analytics/PageViewTracker.tsx
// ------------------------------------------------------------
// Tracker de page views first-party (App Router).
//  - Mesure le TEMPS ACTIF : le chrono ne tourne que quand
//    l'onglet est visible (pause sur blur / visibilitychange).
//  - Émet un beacon à chaque changement de route ET au départ
//    (visibilitychange→hidden / pagehide), via navigator.sendBeacon
//    (Blob text/plain = pas de preflight CORS).
//  - N'émet RIEN tant que le consentement « mesure d'audience »
//    n'est pas accordé (cf. lib/analytics/consent).
// ============================================================

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, hasAnalyticsConsent } from "@/lib/analytics/consent";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Surfaces internes exclues de la mesure d'audience.
function isTracked(path: string): boolean {
  return !path.startsWith("/admin");
}

export default function PageViewTracker() {
  const pathname = usePathname();

  const pathRef    = useRef<string>(pathname);
  const accumRef   = useRef<number>(0);          // ms actifs cumulés sur la page courante
  const startRef   = useRef<number | null>(null); // début de l'intervalle actif courant
  const sentRef    = useRef<boolean>(false);      // beacon déjà envoyé pour cette page ?
  const consentRef = useRef<boolean>(false);

  // ── Helpers chrono (basés sur refs, stables) ──
  const pause = () => {
    if (startRef.current !== null) {
      accumRef.current += Date.now() - startRef.current;
      startRef.current = null;
    }
  };
  const resume = () => {
    if (startRef.current === null && document.visibilityState === "visible") {
      startRef.current = Date.now();
    }
  };
  const currentMs = () =>
    accumRef.current + (startRef.current !== null ? Date.now() - startRef.current : 0);

  const flush = (path: string) => {
    if (!consentRef.current || sentRef.current) return;
    if (!isTracked(path)) return;
    pause();
    const activeMs = currentMs();
    sentRef.current = true;
    try {
      const payload = JSON.stringify({
        path,
        activeMs,
        referrer: document.referrer || null,
      });
      const blob = new Blob([payload], { type: "text/plain" });
      navigator.sendBeacon(`${API_BASE}/analytics/pageview`, blob);
    } catch {
      /* sendBeacon indisponible : on abandonne silencieusement */
    }
  };

  const startPage = (path: string) => {
    pathRef.current  = path;
    accumRef.current = 0;
    startRef.current = null;
    sentRef.current  = false;
    resume();
  };

  // ── Listeners globaux (montés une fois) ──
  useEffect(() => {
    consentRef.current = hasAnalyticsConsent();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush(pathRef.current); // départ probable → on capture maintenant
      } else {
        resume();
      }
    };
    const onPageHide = () => flush(pathRef.current);
    const onConsent = () => {
      consentRef.current = hasAnalyticsConsent();
      if (consentRef.current) startPage(pathRef.current); // démarre dès l'accord
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener(CONSENT_EVENT, onConsent);

    // Démarre le chrono de la première page si déjà consenti.
    if (consentRef.current) resume();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener(CONSENT_EVENT, onConsent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Changement de route : flush l'ancienne, démarre la nouvelle ──
  useEffect(() => {
    if (pathname === pathRef.current && sentRef.current === false) {
      // Premier rendu : initialise sans flush.
      startPage(pathname);
      return;
    }
    flush(pathRef.current);
    startPage(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

// ANALYTICS-V1 applied
