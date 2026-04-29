// ARCHIVE-PRICING-PAGE-V2
// Topbar discrète au-dessus du contenu dashboard.
// Affiche : pill plan (avec badge trial si applicable) + QuotaSummary à droite.

"use client";

import Link from "next/link";
import { useTiers } from "@/hooks/useTiers";
import { QuotaSummary } from "./QuotaSummary";

export function DashboardTopbar() {
  const { plan, isLoggedIn, isTrial, daysLeftInTrial, isFree } = useTiers();

  if (!isLoggedIn) return null;

  const planName  = plan?.name ?? "Découverte";
  const planCode  = plan?.code ?? "free";
  const isPremium = planCode === "premium";

  return (
    <div
      role="region"
      aria-label="Plan et quotas"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "10px 20px",
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--bg-raised)",
        backdropFilter: "blur(8px)",
        flexWrap: "wrap",
      }}
    >
      {/* Pill plan + badge trial */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <PlanPill name={planName} code={planCode} />
        {isTrial && daysLeftInTrial !== null && (
          <TrialBadge days={daysLeftInTrial} />
        )}
        {(isFree || isTrial) && !isPremium && (
          <Link
            href="/pricing"
            style={{
              fontSize: 11,
              color: "var(--gold)",
              fontFamily: "var(--font-display)",
              letterSpacing: ".5px",
              fontStyle: "italic",
              textDecoration: "none",
              padding: "2px 0",
            }}
          >
            ✦ Voir les plans
          </Link>
        )}
      </div>

      {/* Quotas à droite */}
      <QuotaSummary />
    </div>
  );
}

function PlanPill({ name, code }: { name: string; code: string }) {
  const isPremium   = code === "premium";
  const isEssential = code === "essential";

  const bg = isPremium
    ? "var(--bg-pressed)"
    : isEssential
      ? "var(--gold)"
      : "var(--chip-bg)";

  const color = isPremium
    ? "var(--gold)"
    : isEssential
      ? "var(--bg)"
      : "var(--star)";

  const border = isPremium
    ? "1px solid var(--gold)"
    : isEssential
      ? "1px solid var(--gold)"
      : "1px solid var(--border-soft)";

  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            6,
        padding:        "4px 11px",
        borderRadius:   999,
        fontFamily:     "var(--font-display)",
        fontSize:       11.5,
        letterSpacing:  ".4px",
        background:     bg,
        color:          color,
        border:         border,
        fontWeight:     500,
      }}
    >
      <span aria-hidden style={{ fontSize: 10 }}>✦</span>
      <span>{name}</span>
    </span>
  );
}

function TrialBadge({ days }: { days: number }) {
  const urgent = days <= 2;

  // Reformulation UX claire : "Essai gratuit · X jours restants"
  // Cas spéciaux : "Dernier jour !" si <= 1 jour restant.
  const label = days <= 1
    ? "Essai gratuit · dernier jour"
    : `Essai gratuit · ${days} jours restants`;

  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        padding:        "3px 10px",
        borderRadius:   999,
        fontSize:       11,
        fontFamily:     "var(--font-display)",
        letterSpacing:  ".3px",
        background:     urgent ? "rgba(228, 69, 69, .12)" : "var(--bg-raised)",
        color:          urgent ? "var(--tension)" : "var(--muted)",
        border:         `1px solid ${urgent ? "var(--tension)" : "var(--border-soft)"}`,
        whiteSpace:     "nowrap",
      }}
      aria-label={label}
    >
      {label}
    </span>
  );
}

// ARCHIVE-PRICING-POLISH-V1 applied
