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
    allUnlimited:   "Tout illimité",
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
        // PAYWALL-V3 : remplacement de ai.natal_reading par horoscope du jour.
        // Le profil psychologique Kairos est désormais gratuit pour tous ; le
        // quota mensuel porte sur les consultations de l'horoscope du jour
        // dans l'app (la notification push quotidienne reste illimitée).
        feature:   "horoscope.daily.monthly",
        label:     "horoscopes du jour",
        labelOne:  "horoscope du jour",
        qualif:    "restants",
        qualifOne: "restant",
        unlimited: "Horoscopes illimités",
        exhausted: "Aucun horoscope restant",
        fallback:  "Horoscopes du jour",
      },
    ] satisfies QuotaSpec[],
  },
  en: {
    groupAriaLabel: "Usage quotas",
    outOf:          "of",
    thisMonth:      "this month",
    allUnlimited:   "Unlimited everything",
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
        feature:   "horoscope.daily.monthly",
        label:     "daily horoscopes",
        labelOne:  "daily horoscope",
        qualif:    "left",
        qualifOne: "left",
        unlimited: "Unlimited horoscopes",
        exhausted: "No horoscopes left",
        fallback:  "Daily horoscopes",
      },
    ] satisfies QuotaSpec[],
  },
} as const;

interface QuotaSummaryProps {
  className?: string;
}

const CONTAINER_STYLE = {
  display:       "flex",
  gap:           8,
  flexWrap:      "wrap" as const,
  alignItems:    "center",
  fontSize:      12,
  fontFamily:    "var(--font-body)",
  color:         "var(--muted)",
  letterSpacing: ".2px",
};

export function QuotaSummary({ className = "" }: QuotaSummaryProps) {
  const { locale } = useApp();
  const lang = locale === "en" ? "en" : "fr";
  const t    = TRANSLATIONS[lang];

  // QUOTA-CONDENSE-UNLIMITED : si TOUS les quotas connus sont illimités
  // (cas Pro typique), on remplace les 3 spans répétés « Kairos illimité ·
  // Tarot illimité · Horoscopes illimités » par un seul « Tout illimité ».
  // Hooks appelés explicitement (pas dans une boucle) pour respecter les
  // règles React Hooks. Les feature keys correspondent à `t.quotas[*].feature`.
  const chat  = useEntitlement("ai.chat.monthly");
  const tarot = useEntitlement("tarot.monthly");
  const horo  = useEntitlement("horoscope.daily.monthly");
  const all   = [chat, tarot, horo];
  const allKnown     = all.every(e => e.known);
  const allUnlimited = allKnown && all.every(e => e.limit === null || e.limit === -1);

  if (allUnlimited) {
    return (
      <div
        className={className}
        role="group"
        aria-label={t.groupAriaLabel}
        style={CONTAINER_STYLE}
      >
        <span
          aria-label={t.allUnlimited}
          style={{ color: "var(--harmony)", fontStyle: "italic" }}
        >
          {t.allUnlimited}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      role="group"
      aria-label={t.groupAriaLabel}
      style={CONTAINER_STYLE}
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
