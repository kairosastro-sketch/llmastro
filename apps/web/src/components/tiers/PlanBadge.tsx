// ARCHIVE-4-TIERS-UI-V1 HOTFIX-4A
// Badge affichant le plan courant, style design system custom.
"use client";

import { useTiers } from "@/hooks/useTiers";

interface PlanBadgeProps {
  showTrialCountdown?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
}

export function PlanBadge({
  showTrialCountdown = true,
  size = "sm",
  onClick,
  className = "",
}: PlanBadgeProps) {
  const { plan, isTrial, daysLeftInTrial } = useTiers();
  if (!plan) return null;

  const content = (
    <>
      <span>{plan.name}</span>
      {isTrial && showTrialCountdown && daysLeftInTrial !== null && (
        <span style={{ opacity: 0.7 }}>· {daysLeftInTrial}j</span>
      )}
    </>
  );

  const style: React.CSSProperties = {
    display:        "inline-flex",
    alignItems:     "center",
    gap:            6,
    padding:        size === "md" ? "5px 13px" : "3px 11px",
    fontSize:       size === "md" ? 12 : 11,
    fontFamily:     "var(--font-display)",
    borderRadius:   13,
    letterSpacing:  ".5px",
    textTransform:  "uppercase",
    background:     "rgba(201,168,76,.10)",
    border:         "1px solid var(--border)",
    color:          "var(--gold)",
    cursor:         onClick ? "pointer" : "default",
    transition:     "background .2s, box-shadow .2s",
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        className={className}
        aria-label={`Plan actuel : ${plan.name}. Voir les plans disponibles.`}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,168,76,.18)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(201,168,76,.10)")}
      >
        {content}
      </button>
    );
  }

  return <span style={style} className={className}>{content}</span>;
}
