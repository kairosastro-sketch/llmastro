// ============================================================
// ARCHIVE-BIBLIOGRAPHY-V1 — SourceAttribution component
// ------------------------------------------------------------
// Affichage discret en bas d'une lecture des références qui
// ont nourri l'interprétation. Lien vers /bibliographie.
// ============================================================

"use client";

import Link from "next/link";
import {
  getRelevantReferences,
  formatReferenceShort,
} from "@/lib/astro-sources";

interface SourceAttributionProps {
  /** Planètes clés (ex. ["sun", "moon", "saturn"]) en lower */
  planets?: string[];
  /** Types d'aspects (ex. ["conjunction", "trine"]) */
  aspectTypes?: string[];
  /** Locale */
  locale?: string;
  /** Nombre max de références à afficher (défaut 4) */
  max?: number;
}

export function SourceAttribution({
  planets = [],
  aspectTypes = [],
  locale = "fr",
  max = 4,
}: SourceAttributionProps) {
  const refs = getRelevantReferences(planets, aspectTypes, max);

  if (refs.length === 0) return null;

  const isFr = locale !== "en";
  const intro = isFr ? "Tradition consultée :" : "Tradition consulted:";
  const seeAll = isFr ? "voir toutes les sources" : "see all sources";

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid var(--border-soft)",
        fontSize: 10.5,
        color: "var(--muted)",
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontStyle: "italic" }}>{intro}</span>{" "}
      <span>
        {refs.map((r, i) => (
          <span key={r.id}>
            {i > 0 ? " · " : ""}
            <span title={`${r.author}, ${r.title} (${r.year})`} style={{ color: "var(--star)" }}>
              {formatReferenceShort(r)}
            </span>
          </span>
        ))}
      </span>
      <span style={{ marginLeft: 10 }}>
        <Link
          href="/bibliographie"
          style={{
            color: "var(--gold)",
            opacity: 0.85,
            borderBottom: "1px solid currentColor",
          }}
        >
          {seeAll} →
        </Link>
      </span>
    </div>
  );
}

// ARCHIVE-BIBLIOGRAPHY-V1 applied
