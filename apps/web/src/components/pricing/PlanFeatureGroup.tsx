// ARCHIVE-PRICING-PAGE-V2
// Affiche un groupe de features dans une carte de plan.
// Ex: "✦ FONDAMENTAUX" suivi des features de cette catégorie.

"use client";

import styles from "./pricing.module.css";
import type { FeatureSpec } from "./featureGroups";

interface PlanFeatureGroupProps {
  glyph: string;
  title: string;
  features: FeatureSpec[];
  values: Map<string, unknown>;
}

export function PlanFeatureGroup({ glyph, title, features, values }: PlanFeatureGroupProps) {
  return (
    <div className={styles.featureGroup}>
      <div className={styles.featureGroupHeader}>
        <span className={styles.featureGroupGlyph} aria-hidden>{glyph}</span>
        <span>{title}</span>
        <span className={styles.featureGroupHeaderLine} aria-hidden />
      </div>
      {features.map((f) => (
        <FeatureRow key={f.key} feature={f} value={values.get(f.key)} />
      ))}
    </div>
  );
}

interface FeatureRowProps {
  feature: FeatureSpec;
  value: unknown;
}

function FeatureRow({ feature, value }: FeatureRowProps) {
  const { label, hint } = feature;
  const { absent, displayValue, unlimited } = resolveDisplay(value);

  return (
    <div className={`${styles.featureRow} ${absent ? styles.featureRowAbsent : ""}`}>
      <div className={styles.featureLabel}>
        <span
          aria-hidden
          className={`${styles.featureMark} ${
            absent ? styles.featureMarkAbsent : styles.featureMarkPresent
          }`}
        >
          {absent ? "·" : "✓"}
        </span>
        {/* PRICING-SYNASTRY-DEFINE-V1 : définition du jargon en tooltip
            natif, souligné pointillé pour signaler l'aide au survol. */}
        <span
          title={hint}
          style={hint ? {
            cursor: "help",
            textDecorationLine: "underline",
            textDecorationStyle: "dotted",
            textUnderlineOffset: 3,
            textDecorationColor: "var(--muted-2, rgba(255,255,255,.35))",
          } : undefined}
        >
          {label}
        </span>
      </div>
      {displayValue !== null && (
        <span
          className={`${styles.featureValue} ${
            unlimited ? styles.featureValueUnlimited : ""
          }`}
        >
          {displayValue}
        </span>
      )}
    </div>
  );
}

interface DisplayResult {
  absent: boolean;
  displayValue: string | null;
  unlimited: boolean;
}

function resolveDisplay(value: unknown): DisplayResult {
  if (value === undefined || value === null) {
    return { absent: true, displayValue: null, unlimited: false };
  }
  if (typeof value === "boolean") {
    return { absent: !value, displayValue: null, unlimited: false };
  }
  if (typeof value === "number") {
    if (value === -1) return { absent: false, displayValue: "illimité", unlimited: true };
    if (value === 0)  return { absent: true,  displayValue: null,        unlimited: false };
    return { absent: false, displayValue: String(value), unlimited: false };
  }
  if (typeof value === "object" && value !== null && "max" in value) {
    const max = (value as { max: number }).max;
    if (max === -1) return { absent: false, displayValue: "illimité", unlimited: true };
    if (max === 0)  return { absent: true,  displayValue: null,        unlimited: false };
    return { absent: false, displayValue: String(max), unlimited: false };
  }
  return { absent: true, displayValue: null, unlimited: false };
}

// PRICING-SYNASTRY-DEFINE-V1 applied (tooltip hint sur les labels)
