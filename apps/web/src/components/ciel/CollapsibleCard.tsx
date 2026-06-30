// ============================================================
// apps/web/src/components/ciel/CollapsibleCard.tsx
// CIEL-COLLAPSE-V1
// ------------------------------------------------------------
// Section repliable (native <details>) pour les tableaux de
// données de /ciel (positions, aspects, événements). Repliée par
// défaut : /ciel est une landing réseaux sociaux → on met en avant
// la roue 3D + le conseil, les données brutes sont secondaires
// (cf. mémoire « ciel social landing vision »).
//
// Server component pur (pas de JS) : le <details> natif gère le
// pli/dépli — SSR-friendly, accessible, mobile (tap).
// ============================================================

import type { CSSProperties, ReactNode } from "react";

export function CollapsibleCard({
  title,
  ariaLabel,
  defaultOpen = false,
  bare = false,
  children,
}: {
  title: ReactNode;
  ariaLabel?: string;
  /** Ouvert au chargement. Défaut : replié. */
  defaultOpen?: boolean;
  /** Sans fond de carte (pour une section qui contient déjà ses propres sous-cartes). */
  bare?: boolean;
  children: ReactNode;
}) {
  const summaryStyle: CSSProperties = {
    cursor: "pointer",
    color: "var(--gold)",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: bare ? "1.5rem" : "1.3rem",
    fontWeight: 400,
    outline: "none",
  };

  return (
    <details
      className={bare ? undefined : "card"}
      style={bare ? { marginBottom: "2rem" } : { padding: "1.5rem", marginBottom: "2rem" }}
      aria-label={ariaLabel}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary style={summaryStyle}>{title}</summary>
      <div style={{ marginTop: "1rem" }}>{children}</div>
    </details>
  );
}

// CIEL-COLLAPSE-V1 CollapsibleCard applied
