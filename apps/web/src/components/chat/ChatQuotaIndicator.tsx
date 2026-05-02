"use client";

// CHAT-PERSISTENCE-V1-UI-A
// Indicateur de quota de sauvegardes pour le chat Kairos.
//
// 4 états visuels :
//  1. quota null (loading) → "…" muted
//  2. limit === -1 (illimité, premium) → "Sauvegardes illimitées" en or
//  3. free + quota épuisée → bouton "1/1 — Essentiel pour plus" cliquable
//  4. cas standard (free avec capacité, ou essential) → "Sauvegardes : N/M"

import type { CSSProperties } from "react";

interface QuotaInfo {
  limit:   number;   // -1 = unlimited, 0 = disabled, N = explicit limit
  current: number;
  canSave: boolean;
}

interface Props {
  quota:          QuotaInfo | null;
  isFree:         boolean;
  locale:         string;
  onUpgradeClick: () => void;
}

const TEXT_BASE: CSSProperties = {
  fontSize:      11,
  fontFamily:    "inherit",
  letterSpacing: 0.2,
  flexShrink:    1,
  minWidth:      0,
};

export function ChatQuotaIndicator({
  quota,
  isFree,
  locale,
  onUpgradeClick,
}: Props) {
  // Loading
  if (!quota) {
    return (
      <span style={{ ...TEXT_BASE, color: "var(--muted-2, #8a8598)" }}>
        …
      </span>
    );
  }

  // Premium / unlimited
  if (quota.limit === -1) {
    return (
      <span style={{ ...TEXT_BASE, color: "var(--gold, #d4a843)" }}>
        {locale === "en" ? "Unlimited saves" : "Sauvegardes illimitées"}
      </span>
    );
  }

  // Free + quota épuisée → CTA upgrade cliquable
  if (isFree && !quota.canSave) {
    return (
      <button
        onClick={onUpgradeClick}
        style={{
          background:   "transparent",
          border:       "1px solid var(--border-soft, rgba(212,168,67,.25))",
          color:        "var(--gold-l, #d4a843)",
          borderRadius: 999,
          padding:      "3px 10px",
          fontSize:     11,
          cursor:       "pointer",
          fontFamily:   "inherit",
          letterSpacing: 0.2,
          flexShrink:   0,
          whiteSpace:   "nowrap",
        }}
        aria-label={locale === "en" ? "Upgrade plan" : "Passer à un forfait supérieur"}
      >
        {quota.current}/{quota.limit} —{" "}
        {locale === "en" ? "Upgrade for more" : "Essentiel pour plus"}
      </button>
    );
  }

  // Cas standard
  return (
    <span style={{ ...TEXT_BASE, color: "var(--muted-2, #8a8598)" }}>
      {locale === "en" ? "Saves" : "Sauvegardes"} : {quota.current}/{quota.limit}
    </span>
  );
}

// CHAT-PERSISTENCE-V1-UI-A applied
