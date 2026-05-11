// ARCHIVE-LANDING-EPHEMERIDES-V2
// QuotaSummary v4 — i18n FR/EN.
// Singulier/pluriel/féminin auto :
//   FR : "1 message restant"   / "250 messages restants"
//        "1 lecture restante"  / "2 lectures restantes" (féminin)
//   EN : "1 message left"      / "250 messages left"

"use client";

import { useEntitlement } from "@/hooks/useEntitlement";
import { useApp } from "@/lib/i18n";

interface QuotaSpec {
  feature:    string;
  label:      string;       // pluriel
  labelOne:   string;       // singulier
  qualif:     string;       // qualificatif pluriel (FR: "restants"/"restantes", EN: "left")
  qualifOne:  string;       // qualificatif singulier (FR: "restant"/"restante", EN: "left")
  unlimited:  string;       // texte si illimité (Pro)
  exhausted:  string;       // texte si épuisé ("Aucun X" / "No X left")
  fallback:   string;       // libellé court pour aria-label
}

const TRANSLATIONS = {
  fr: {
    groupAriaLabel: "Quotas d'utilisation",
    outOf:          "sur",
    thisMonth:      "ce mois-ci",
    quotas: [
      {
        feature:   "ai.chat.monthly",
        label:     "messages",
        labelOne:  "message",
        qualif:    "restants",
        qualifOne: "restant",
        unlimited: "Kairos illimité",
        exhausted: "Aucun message restant",
        fallback:  "Kairos",
      },
      {
        feature:   "tarot.monthly",
        label:     "tirages",
        labelOne:  "tirage",
        qualif:    "restants",
        qualifOne: "restant",
        unlimited: "Tarot illimité",
        exhausted: "Aucun tirage restant",
        fallback:  "Tarot",
      },
      {
        feature:   "ai.natal_reading.monthly",
        label:     "lectures",
        labelOne:  "lecture",
        qualif:    "restantes",
        qualifOne: "restante",
        unlimited: "Lectures illimitées",
        exhausted: "Aucune lecture restante",
        fallback:  "Lectures",
      },
    ] satisfies QuotaSpec[],
  },
  en: {
    groupAriaLabel: "Usage quotas",
    outOf:          "of",
    thisMonth:      "this month",
    quotas: [
      {
        feature:   "ai.chat.monthly",
        label:     "messages",
        labelOne:  "message",
        qualif:    "left",
        qualifOne: "left",
        unlimited: "Unlimited Kairos",
        exhausted: "No messages left",
        fallback:  "Kairos",
      },
      {
        feature:   "tarot.monthly",
        label:     "draws",
        labelOne:  "draw",
        qualif:    "left",
        qualifOne: "left",
        unlimited: "Unlimited Tarot",
        exhausted: "No draws left",
        fallback:  "Tarot",
      },
      {
        feature:   "ai.natal_reading.monthly",
        label:     "readings",
        labelOne:  "reading",
        qualif:    "left",
        qualifOne: "left",
        unlimited: "Unlimited Readings",
        exhausted: "No readings left",
        fallback:  "Readings",
      },
    ] satisfies QuotaSpec[],
  },
} as const;

interface QuotaSummaryProps {
  className?: string;
}

export function QuotaSummary({ className = "" }: QuotaSummaryProps) {
  const { locale } = useApp();
  const lang = locale === "en" ? "en" : "fr";
  const t    = TRANSLATIONS[lang];

  return (
    <div
      className={className}
      role="group"
      aria-label={t.groupAriaLabel}
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
      {t.quotas.map((q, idx) => (
        <QuotaItem
          key={q.feature}
          spec={q}
          showSeparator={idx < t.quotas.length - 1}
          outOf={t.outOf}
          thisMonth={t.thisMonth}
        />
      ))}
    </div>
  );
}

function QuotaItem({
  spec, showSeparator, outOf, thisMonth,
}: {
  spec:          QuotaSpec;
  showSeparator: boolean;
  outOf:         string;
  thisMonth:     string;
}) {
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

  const mainText = exhausted
    ? spec.exhausted
    : `${left} ${word} ${qualif}`;

  const ariaLabel = exhausted
    ? `${spec.fallback}: ${spec.exhausted} ${thisMonth}`
    : `${spec.fallback}: ${left} ${word} ${qualif} ${outOf} ${limit} ${thisMonth}`;

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
