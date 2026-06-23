"use client";

// ============================================================
// CIEL-SHARE-V1 — Bouton de partage réutilisable.
// Mobile : ouvre la feuille de partage native (Web Share API) →
// l'utilisateur choisit Instagram / X / Messages / etc.
// Desktop (pas de navigator.share) : repli sur copie du lien
// dans le presse-papier, avec retour visuel.
// ============================================================

import { useState } from "react";

export interface ShareButtonProps {
  /** URL absolue à partager. */
  url: string;
  /** Titre (feuille de partage native). */
  title: string;
  /** Texte d'accompagnement (feuille de partage native). */
  text: string;
  /** Libellé du bouton. */
  label: string;
  /** Libellé affiché après copie du lien (repli desktop). */
  copiedLabel: string;
}

export function ShareButton({ url, title, text, label, copiedLabel }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // partage annulé par l'utilisateur — silencieux
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // presse-papier indisponible — silencieux
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 1rem",
        borderRadius: 999,
        border: "1px solid var(--border-mid)",
        background: "var(--card-bg)",
        color: copied ? "var(--gold)" : "var(--muted)",
        font: "inherit",
        fontSize: "0.9rem",
        cursor: "pointer",
        transition: "color 200ms, border-color 200ms",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
