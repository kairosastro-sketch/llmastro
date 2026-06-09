// ARCHIVE-4-TIERS-UI-V1 HOTFIX-4A
// CTA d'upgrade avec style design system (btn-ob, btn-ghost).
"use client";

import { useTiers } from "@/hooks/useTiers";

interface UpgradeCTAProps {
  feature?:    string;
  targetPlan?: "essential" | "premium";
  variant?:    "primary" | "ghost" | "inline";
  label?:      string;
  className?:  string;
}

// Noms alignés sur apps/api/src/config/plans.config.ts (source de vérité)
const PLAN_NAMES = {
  essential: "Essentiel",
  premium:   "Pro",
};

export function UpgradeCTA({
  feature,
  targetPlan,
  variant = "primary",
  label,
  className = "",
}: UpgradeCTAProps) {
  const { plan, openPaywall } = useTiers();

  const suggested: "essential" | "premium" =
    targetPlan ?? (plan?.code === "essential" ? "premium" : "essential");

  const displayLabel = label ?? `Passer à ${PLAN_NAMES[suggested]}`;

  if (variant === "primary") {
    return (
      <button
        type="button"
        onClick={() => openPaywall({ feature })}
        className={`btn-ob ${className}`.trim()}
        style={{ width: "auto", padding: "10px 20px", fontSize: 13 }}
      >
        {displayLabel} →
      </button>
    );
  }

  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={() => openPaywall({ feature })}
        className={`btn-ghost ${className}`.trim()}
      >
        {displayLabel}
      </button>
    );
  }

  // inline
  return (
    <button
      type="button"
      onClick={() => openPaywall({ feature })}
      className={className}
      style={{
        fontSize:  11,
        color:     "var(--gold)",
        textDecoration: "underline",
        textDecorationColor: "var(--border)",
        textUnderlineOffset: 3,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {displayLabel}
    </button>
  );
}
