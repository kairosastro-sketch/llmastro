// ARCHIVE-LANDING-EPHEMERIDES-V2
// QuotaSummary v3 — ajoute "restants" pour clarifier le sens des chiffres.
// Singulier/pluriel/féminin auto :
//   "1 message restant"     "250 messages restants"
//   "1 tirage restant"      "25 tirages restants"
//   "1 lecture restante"    "2 lectures restantes" (féminin)

"use client";

import { useEntitlement } from "@/hooks/useEntitlement";

interface QuotaSpec {
  feature:    string;
  label:      string;       // pluriel masc/fem ex: "messages"
  labelOne:   string;       // singulier ex: "message"
  qualif:     string;       // qualificatif pluriel ex: "restants" / "restantes"
  qualifOne:  string;       // qualificatif singulier ex: "restant" / "restante"
  unlimited:  string;       // texte si illimité
  fallback:   string;       // libellé pour aria-label / errors
}

const QUOTAS: QuotaSpec[] = [
  {
    feature:   "ai.chat.monthly",
    label:     "messages",
    labelOne:  "message",
    qualif:    "restants",
    qualifOne: "restant",
    unlimited: "Kairos illimité",
    fallback:  "Kairos",
  },
  {
    feature:   "tarot.monthly",
    label:     "tirages",
    labelOne:  "tirage",
    qualif:    "restants",
    qualifOne: "restant",
    unlimited: "Tarot illimité",
    fallback:  "Tarot",
  },
  {
    feature:   "ai.natal_reading.monthly",
    label:     "lectures",
    labelOne:  "lecture",
    qualif:    "restantes",
    qualifOne: "restante",
    unlimited: "Lectures illimitées",
    fallback:  "Lectures",
  },
];

interface QuotaSummaryProps {
  className?: string;
}

export function QuotaSummary({ className = "" }: QuotaSummaryProps) {
  return (
    <div
      className={className}
      role="group"
      aria-label="Quotas d'utilisation"
      style={{
        display:       "flex",
        gap:           8,
        flexWrap:      "wrap",
        alignItems:    "center",
        fontSize:      12,
        fontFamily:    "var(--font-body)",
        color:         "var(--muted)",
        letterSpacing: ".2px",
      }}
    >
      {QUOTAS.map((q, idx) => (
        <QuotaItem
          key={q.feature}
          spec={q}
          showSeparator={idx < QUOTAS.length - 1}
        />
      ))}
    </div>
  );
}

function QuotaItem({ spec, showSeparator }: { spec: QuotaSpec; showSeparator: boolean }) {
  const { limit, remaining, known } = useEntitlement(spec.feature);

  if (!known) return null;

  // Cas illimité (Pro)
  if (limit === null || limit === -1) {
    return (
      <span
        aria-label={spec.unlimited}
        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ color: "var(--harmony)", fontStyle: "italic" }}>
          {spec.unlimited}
        </span>
        {showSeparator && <Separator />}
      </span>
    );
  }

  // Cas quota chiffré
  const left = remaining ?? limit;
  const exhausted = left <= 0;
  const word     = left === 1 ? spec.labelOne : spec.label;
  const qualif   = left === 1 ? spec.qualifOne : spec.qualif;

  // Texte principal :
  //   - "250 messages restants"
  //   - "Aucun message restant" si épuisé
  const mainText = exhausted
    ? `Aucun ${spec.labelOne} ${spec.qualifOne}`
    : `${left} ${word} ${qualif}`;

  const ariaLabel = exhausted
    ? `${spec.fallback} : aucun ${spec.labelOne} ${spec.qualifOne} ce mois-ci`
    : `${spec.fallback} : ${left} ${word} ${qualif} sur ${limit} ce mois-ci`;

  return (
    <span
      aria-label={ariaLabel}
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <span
        title={ariaLabel}
        style={{
          color:      exhausted ? "var(--tension)" : "var(--star)",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {mainText}
      </span>
      {showSeparator && <Separator />}
    </span>
  );
}

function Separator() {
  return (
    <span aria-hidden style={{
      color:      "var(--muted-2)",
      userSelect: "none",
      fontSize:   11,
    }}>
      ·
    </span>
  );
}
