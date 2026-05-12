// ARCHIVE-4-TIERS-UI-V1 HOTFIX-4A
// Modal paywall en style design system custom.
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTiersContext } from "@/contexts/TiersContext";
import { useTiers } from "@/hooks/useTiers";
import { humanFeatureLabel } from "@/lib/tiers/feature-labels"; // PAYWALL-FRONT-V1

export function PaywallModal() {
  const { paywall, closePaywall } = useTiersContext();
  const { plan } = useTiers();

  useEffect(() => {
    if (!paywall.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePaywall();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [paywall.open, closePaywall]);

  if (!paywall.open) return null;

  const currentCode = plan?.code ?? "free";
  const suggestedCode: "essential" | "premium" =
    currentCode === "essential" ? "premium" : "essential";
  const suggestedName = suggestedCode === "premium" ? "Passion" : "Essentiel";

  const { title, description } = buildCopy({
    reason:      paywall.reason,
    feature:     paywall.feature,
    message:     paywall.message,
    suggestedName,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={closePaywall}
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: "rgba(7,5,15,.72)",
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Panel */}
      <div
        className="card"
        style={{
          position:   "relative",
          width:      "100%",
          maxWidth:   460,
          padding:    28,
          boxShadow:  "var(--shadow-float)",
          animation:  "scale-in .4s var(--ease-spring) both",
        }}
      >
        <button
          type="button"
          onClick={closePaywall}
          aria-label="Fermer"
          style={{
            position: "absolute", top: 12, right: 12,
            padding: 6, width: 28, height: 28,
            borderRadius: "50%",
            color: "var(--muted)", fontSize: 14,
            background: "transparent", border: "none",
            cursor: "pointer", lineHeight: 1,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-raised)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          ✕
        </button>

        <div
          className="pill-gold"
          style={{ marginBottom: 16, display: "inline-block" }}
        >
          ✦ Plan {suggestedName}
        </div>

        <h2
          id="paywall-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize:   22,
            color:      "var(--gold)",
            marginBottom: 10,
            lineHeight: 1.25,
          }}
        >
          {title}
        </h2>

        <p style={{
          fontSize:  13.5,
          color:     "var(--star)",
          opacity:   0.78,
          lineHeight: 1.55,
          fontFamily: "var(--font-display)",
        }}>
          {description}
        </p>

        {paywall.feature && (
          <div style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: "var(--r-md)",
            background: "var(--surface-alt)",
            border: "1px solid var(--border-soft)",
            fontSize: 11,
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
          }}>
            {paywall.feature}
          </div>
        )}

        <div style={{
          marginTop: 24,
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}>
          <button
            type="button"
            onClick={closePaywall}
            className="btn-ghost"
            style={{ padding: "8px 16px", fontSize: 12.5 }}
          >
            Plus tard
          </button>
          <Link
            href={paywall.feature ? `/pricing?feature=${encodeURIComponent(paywall.feature)}` : "/pricing"}
            onClick={closePaywall}
            className="btn-ob"
            style={{
              width:    "auto",
              padding:  "11px 22px",
              fontSize: 13,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Voir les plans →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// Copywriting contextuel
// ----------------------------------------------------------
interface CopyParams {
  reason:        "feature_not_available" | "quota_exceeded" | "entitlement_denied" | "manual";
  feature:       string | null;
  message:       string | null;
  suggestedName: string;
}

function buildCopy({ reason, feature, message, suggestedName }: CopyParams): {
  title:       string;
  description: string;
} {
  if (message) {
    return { title: "Cette fonctionnalité demande un plan supérieur", description: message };
  }

  if (reason === "quota_exceeded") {
    return {
      title:       "Tu as atteint ta limite pour cette période",
      description: `Passe à ${suggestedName} pour continuer sans limite, ou reviens demain pour repartir à zéro.`,
    };
  }

  if (reason === "feature_not_available" || reason === "entitlement_denied") {
    const featName = humanFeatureLabel(feature);
    if (featName) {
      return {
        title:       `${featName} fait partie de ${suggestedName}`,
        description: "Débloque cette fonctionnalité et bien d'autres en passant à un plan supérieur.",
      };
    }
    return {
      title:       `Cette fonctionnalité fait partie de ${suggestedName}`,
      description: "Débloque plus de possibilités pour explorer ton ciel.",
    };
  }

  return {
    title:       `Découvre ${suggestedName}`,
    description: "Plus de profils, plus de messages, plus de fonctionnalités avancées.",
  };
}

// ARCHIVE-TIERS-V2-CONFIG applied
