"use client";

// TAROT-PERSISTENCE-V1
// Bouton qui ouvre le drawer "Mes tirages".
// Miroir de ChatDrawerToggle.

import type { CSSProperties } from "react";

interface Props {
  onClick: () => void;
  isOpen:  boolean;
  locale:  string;
}

export function TarotDrawerToggle({ onClick, isOpen, locale }: Props) {
  const baseStyle: CSSProperties = {
    background:    "transparent",
    border:        "1px solid var(--border-soft, rgba(212,168,67,.25))",
    color:         "var(--gold-l, #d4a843)",
    borderRadius:  8,
    padding:       "6px 10px",
    fontSize:      13,
    cursor:        "pointer",
    fontFamily:    "inherit",
    transition:    "background .15s var(--ease-out, ease), border-color .15s ease",
    whiteSpace:    "nowrap",
    flexShrink:    0,
    display:       "inline-flex",
    alignItems:    "center",
    gap:           4,
  };

  const openStyle: CSSProperties = isOpen
    ? {
        background:  "rgba(201,168,76,.12)",
        borderColor: "var(--gold, #c9a84c)",
      }
    : {};

  const label = locale === "en" ? "My readings" : "Mes tirages";

  return (
    <button
      onClick={onClick}
      style={{ ...baseStyle, ...openStyle }}
      aria-label={label}
      aria-expanded={isOpen}
      title={label}
    >
      <span aria-hidden="true">🃏</span>
      <span>{label}</span>
    </button>
  );
}

// TAROT-PERSISTENCE-V1 applied
