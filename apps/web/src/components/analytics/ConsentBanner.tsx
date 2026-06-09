// ============================================================
// ANALYTICS-V1
// apps/web/src/components/analytics/ConsentBanner.tsx
// ------------------------------------------------------------
// Bandeau de consentement RGPD « mesure d'audience ». Tant que
// l'utilisateur n'a pas tranché, le tracker reste muet. Le choix
// est mémorisé en localStorage (cf. lib/analytics/consent).
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONSENT_EVENT, getConsent, setConsent } from "@/lib/analytics/consent";

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === "unset");
    const onChange = () => setVisible(getConsent() === "unset");
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentement mesure d'audience"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 1000,
        maxWidth: 520,
        margin: "0 auto",
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--r-md)",
        boxShadow: "0 8px 32px rgba(0,0,0,.35)",
        padding: 18,
      }}
    >
      <p style={{ fontSize: 13, color: "var(--star)", lineHeight: 1.5, margin: 0 }}>
        Nous mesurons l'audience du site (pages vues, temps passé) pour
        l'améliorer. Aucune donnée n'est revendue. Vous pouvez refuser sans
        impact sur votre navigation.{" "}
        <Link href="/confidentialite" style={{ color: "var(--gold)", textDecoration: "underline" }}>
          En savoir plus
        </Link>
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "8px 16px", fontSize: 13 }}
          onClick={() => setConsent("denied")}
        >
          Refuser
        </button>
        <button
          type="button"
          style={{
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 700,
            border: "none",
            borderRadius: "var(--r-md)",
            cursor: "pointer",
            color: "var(--bg)",
            background: "linear-gradient(135deg, var(--gold), var(--gold-l))",
          }}
          onClick={() => setConsent("granted")}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}

// ANALYTICS-V1 applied
