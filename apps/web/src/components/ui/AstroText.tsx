// ============================================================
// PATCH-ASTRO-TOOLTIPS-V1
// AstroText : wrap les termes astrologiques (aspects, planètes)
// avec un tooltip HTML natif (attribut title).
//
// - Regex word-boundary pour éviter les sous-chaînes
// - Ne matche pas si suivi d'un chiffre (évite "Mars 2026" → planète)
// - Souligné pointillé doré pour signaler l'interactivité
// - Fonctionne mobile (long-press → tooltip système)
// ============================================================

"use client";

import { Fragment, useMemo } from "react";
import { useApp } from "@/lib/i18n";
import { ASTRO_GLOSSARY, ASTRO_TERMS_SORTED } from "@/lib/astro-glossary";

// Échappe les caractères regex spéciaux dans une string
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Construit la regex une seule fois (au chargement du module).
// Pattern : (a|b|c)(?!\s*\d)
//   - groupe capturant des termes alternatives (triés par longueur décroissante)
//   - lookahead négatif : pas de chiffre juste après
// On utilise des word boundaries Unicode-aware via lookaround pour les caractères
// accentués (\b ne marche pas pour Vénus, Carré, etc.)
const TERMS_PATTERN = ASTRO_TERMS_SORTED.map(escapeRegex).join("|");

// Lookbehind : pas précédé d'une lettre/chiffre Unicode
// Lookahead : pas suivi d'une lettre/chiffre Unicode (pour éviter "Mercurelune")
//             ET pas suivi d'un chiffre après whitespace optionnel (pour éviter "Mars 2026")
const ASTRO_REGEX = new RegExp(
  `(?<![\\p{L}\\p{N}])(${TERMS_PATTERN})(?![\\p{L}\\p{N}])(?!\\s*\\d)`,
  "gu",
);

interface AstroTextProps {
  children: string | undefined | null;
  /** Pour utiliser comme inline (par défaut span) ou block (p, div) */
  as?: "span" | "p" | "div";
  /** Pass-through className */
  className?: string;
  /** Pass-through style */
  style?: React.CSSProperties;
}

export function AstroText({
  children,
  as: Tag = "span",
  className,
  style,
}: AstroTextProps) {
  const { locale } = useApp();

  // Mémoïse le rendu pour éviter de re-parser à chaque re-render
  const nodes = useMemo(() => {
    if (!children || typeof children !== "string") return null;

    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    // Reset lastIndex (la regex est globale, partagée)
    ASTRO_REGEX.lastIndex = 0;

    while ((match = ASTRO_REGEX.exec(children)) !== null) {
      const term = match[0];
      const idx = match.index;

      // Texte avant le match
      if (idx > lastIdx) {
        parts.push(children.slice(lastIdx, idx));
      }

      // Le terme wrappé
      const def = ASTRO_GLOSSARY[term];
      if (def) {
        parts.push(
          <span
            key={`${idx}-${term}`}
            title={def[locale === "en" ? "en" : "fr"]}
            className="astro-term"
            style={{
              borderBottom: "1px dotted var(--gold)",
              cursor: "help",
              textDecoration: "none",
            }}
          >
            {term}
          </span>,
        );
      } else {
        // Sécurité : si pas trouvé, on garde le terme tel quel
        parts.push(term);
      }

      lastIdx = idx + term.length;
    }

    // Texte restant après le dernier match
    if (lastIdx < children.length) {
      parts.push(children.slice(lastIdx));
    }

    return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
  }, [children, locale]);

  if (!children) return null;

  return (
    <Tag className={className} style={style}>
      {nodes}
    </Tag>
  );
}
