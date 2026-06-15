// ============================================================
// apps/web/src/components/pwa/OfflineBanner.tsx
// PWA-OFFLINE-V1
// ------------------------------------------------------------
// Indicateur global affiché quand le navigateur passe hors-ligne.
// Prévient que les données visibles datent de la dernière connexion
// (elles viennent du cache SW / React Query, pas du réseau).
//
// Écoute les events `online`/`offline` du navigateur. Rendu en
// position:fixed via createPortal(document.body) — sinon un conteneur
// parent en `transform` piégerait le fixed (cf. modal-portal-pitfall).
//
// Style « Céleste » soft, inline + var(--*) (aucune classe blacklistée).
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/i18n";

export function OfflineBanner() {
  const { locale } = useApp();
  const [mounted, setMounted] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setMounted(true);
    // État initial : navigator.onLine (false = sûrement hors-ligne).
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);

    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!mounted || !offline) return null;

  const t = locale === "en" ? EN : FR;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: "min(92vw, 460px)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        borderRadius: 999,
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--shadow-soft)",
        color: "var(--star)",
        fontSize: 12.5,
        lineHeight: 1.35,
        backdropFilter: "blur(8px)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--tension)",
        }}
      />
      <span>
        <strong style={{ fontWeight: 600 }}>{t.title}</strong>
        <span style={{ color: "var(--muted)" }}> — {t.body}</span>
      </span>
    </div>,
    document.body,
  );
}

const FR = {
  title: "Hors-ligne",
  body: "les données affichées datent de votre dernière connexion.",
};
const EN = {
  title: "Offline",
  body: "the data shown is from your last connection.",
};

// PWA-OFFLINE-V1 offline banner applied
