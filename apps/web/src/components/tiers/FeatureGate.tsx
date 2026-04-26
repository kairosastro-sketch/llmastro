// ARCHIVE-4-TIERS-UI-V1 HOTFIX-4A
// Gate de feature, mode teaser restylé avec design system custom.
"use client";

import type { ReactNode } from "react";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useTiers } from "@/hooks/useTiers";

interface FeatureGateProps {
  feature:       string;
  mode?:         "hide" | "fallback" | "teaser";
  fallback?:     ReactNode;
  teaserMessage?: string;
  children:      ReactNode;
  className?:    string;
}

export function FeatureGate({
  feature,
  mode = "hide",
  fallback = null,
  teaserMessage,
  children,
  className = "",
}: FeatureGateProps) {
  const { allowed, known } = useEntitlement(feature);
  const { openPaywall } = useTiers();

  if (!known) return null;
  if (allowed) return <>{children}</>;

  if (mode === "hide") return null;
  if (mode === "fallback") return <>{fallback}</>;

  // mode === "teaser"
  return (
    <div
      onClick={() => openPaywall({ feature, message: teaserMessage })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPaywall({ feature, message: teaserMessage });
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Fonctionnalité non disponible dans ton plan. Clic pour en savoir plus."
      className={className}
      style={{ position: "relative", cursor: "pointer", userSelect: "none" }}
    >
      <div style={{ pointerEvents: "none", opacity: 0.35, filter: "grayscale(1)" }}>
        {children}
      </div>
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <span className="pill-gold" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 16px",
          boxShadow: "var(--shadow-soft)",
        }}>
          ✦ Débloquer
        </span>
      </div>
    </div>
  );
}
