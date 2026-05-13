// ARCHIVE-4-TIERS-UI-V1 HOTFIX-4A
// Indicateur de quota : barre de progression ou compact.
// Utilise la classe .ebar du design system.
"use client";

import { useQuota } from "@/hooks/useQuota";

interface QuotaIndicatorProps {
  feature:   string;
  variant?:  "bar" | "compact";
  label?:    string;
  showReset?: boolean;
  className?: string;
}

const HUMAN_LABELS: Record<string, string> = {
  "ai.chat.monthly":            "Messages Kairos ce mois-ci",
  "ai.chat.credits":          "Crédits Kairos",
  "tarot.monthly":              "Tirages de tarot ce mois-ci",
  "synastry.monthly":         "Synastries ce mois",
  "reports.monthly_credits":  "Rapports ce mois",
  "horoscope.daily.monthly":    "Horoscopes du jour ce mois",
};

export function QuotaIndicator({
  feature,
  variant = "bar",
  label,
  showReset = true,
  className = "",
}: QuotaIndicatorProps) {
  const q = useQuota(feature);

  if (!q.known) return null;
  if (q.limit === null && !q.unlimited) return null;

  const displayLabel = label ?? HUMAN_LABELS[feature] ?? feature;

  if (q.unlimited) {
    return (
      <div className={className} style={{ fontSize: 11, color: "var(--muted)" }}>
        {displayLabel} · <span style={{ color: "var(--harmony)", fontFamily: "var(--font-display)" }}>illimité</span>
      </div>
    );
  }

  const limit     = q.limit ?? 0;
  const remaining = q.remaining ?? 0;
  const consumed  = q.consumed  ?? 0;
  const ratio     = q.ratio     ?? 0;

  // Couleur selon niveau
  const color =
    ratio >= 1 ? "var(--tension)"
    : ratio >= 0.8 ? "var(--neutral)"
    : "var(--gold)";

  if (variant === "compact") {
    return (
      <span
        className={`pill ${className}`.trim()}
        style={{
          display:      "inline-flex",
          alignItems:   "center",
          gap:          6,
          padding:      "3px 11px",
          borderRadius: 13,
          fontSize:     11,
          letterSpacing:".3px",
          background:   "var(--chip-bg)",
          border:       "1px solid var(--border-soft)",
          color:        "var(--star)",
        }}
        aria-label={`${displayLabel}, ${remaining} restants sur ${limit}`}
      >
        <span style={{
          display: "inline-block",
          width: 6, height: 6,
          borderRadius: "50%",
          background: color,
        }} />
        {remaining}/{limit}
      </span>
    );
  }

  // variant === "bar" — utilise la classe .ebar native
  return (
    <div className={`ebar ${className}`.trim()}>
      <div className="ebar-head">
        <span className="lbl">{displayLabel}</span>
        <span className="val">{consumed} / {limit}</span>
      </div>
      <div className="ebar-track">
        <div
          className="ebar-fill"
          style={{
            width: `${Math.min(100, ratio * 100)}%`,
            background: ratio >= 1
              ? "linear-gradient(90deg, var(--tension), var(--tension))"
              : ratio >= 0.8
              ? "linear-gradient(90deg, var(--neutral), var(--gold))"
              : "linear-gradient(90deg, var(--gold), var(--gold-l))",
          }}
        />
      </div>
      {showReset && q.resetLabel && (
        <div style={{ fontSize: 10, color: "var(--muted-2)", marginTop: 4, letterSpacing: ".3px" }}>
          Reset {q.resetLabel}
        </div>
      )}
    </div>
  );
}

// ARCHIVE-TIERS-V2-CONFIG applied
