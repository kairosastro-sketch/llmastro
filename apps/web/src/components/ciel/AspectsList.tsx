// ============================================================
// apps/web/src/components/ciel/AspectsList.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import type { TransitAspect } from "@/lib/server/sky-fetch";
import { getT, type Locale } from "@/lib/i18n/translations";
import { aspectHelp, orbHelp } from "@/lib/astro/aspect-help"; // AUDIT-UX-TOOLTIPS-V1
import { CollapsibleCard } from "@/components/ciel/CollapsibleCard"; // CIEL-COLLAPSE-V1

const PLANET_NAMES: Record<Locale, Record<string, string>> = {
  fr: {
    sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
    mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
    uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
    northNode: "Nœud Nord", southNode: "Nœud Sud",
  },
  en: {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
    mars: "Mars", jupiter: "Jupiter", saturn: "Saturn",
    uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
    northNode: "North Node", southNode: "South Node",
  },
};

const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  northNode: "☊", southNode: "☋",
};

const TONE_COLORS: Record<TransitAspect["tone"], string> = {
  harmony: "var(--harmony)",
  tension: "var(--tension)",
  neutral: "var(--neutral)",
};

interface AspectsListProps {
  aspects: TransitAspect[];
  lang:    Locale;
  /** Combien d'aspects afficher (par priorité décroissante). Default 8. */
  top?: number;
}

export function AspectsList({ aspects, lang, top = 8 }: AspectsListProps) {
  const t = getT(lang);
  const planetNames = PLANET_NAMES[lang];
  const items = (aspects ?? []).slice(0, top);

  // CIEL-COLLAPSE-V1 : section repliée par défaut (landing RS).
  if (items.length === 0) {
    return (
      <CollapsibleCard title={t("ciel_aspects_title")} ariaLabel={t("ciel_aspects_title")}>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          {t("ciel_aspects_none")}
        </p>
      </CollapsibleCard>
    );
  }

  const title =
    t("ciel_aspects_title") +
    (aspects.length > top ? ` — top ${top} (${t("ciel_aspects_of")} ${aspects.length})` : "");

  return (
    <CollapsibleCard title={title} ariaLabel={t("ciel_aspects_title")}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((a, i) => {
          const tName = planetNames[a.transitPlanet] ?? a.transitPlanet;
          const nName = planetNames[a.natalPlanet]   ?? a.natalPlanet;
          const tGlyph = PLANET_GLYPHS[a.transitPlanet] ?? "";
          const nGlyph = PLANET_GLYPHS[a.natalPlanet]   ?? "";
          const typeLabel = (lang === "en" ? a.type : a.typeFr).toLowerCase();
          return (
            <li
              key={`${a.transitPlanet}-${a.natalPlanet}-${a.type}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.5rem 0",
                borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                fontSize: "0.95rem",
              }}
            >
              <span style={{ minWidth: "1.2em", color: "var(--gold)" }} aria-hidden>{tGlyph}</span>
              <span style={{ color: "var(--gold-l)" }}>{tName}</span>
              <span
                style={{
                  color: TONE_COLORS[a.tone],
                  fontSize: "1.1rem",
                  margin: "0 0.3em",
                }}
                aria-hidden
              >
                {a.symbol}
              </span>
              <span
                style={{ color: "var(--muted)", fontSize: "0.85rem", cursor: "help" }}
                title={aspectHelp(a.type, lang)}
              >
                {typeLabel}
              </span>
              <span style={{ minWidth: "1.2em", color: "var(--gold)" }} aria-hidden>{nGlyph}</span>
              <span style={{ color: "var(--gold-l)" }}>{nName}</span>
              <span
                style={{
                  marginLeft: "auto",
                  color: a.exact ? "var(--gold)" : "var(--muted-2)",
                  fontSize: "0.8rem",
                  fontVariantNumeric: "tabular-nums",
                  cursor: "help",
                }}
                title={orbHelp(lang)}
              >
                {t("ciel_aspects_orb")} {a.orb}°{a.exact ? ` · ${t("ciel_aspects_exact")}` : a.tight ? ` · ${t("ciel_aspects_tight")}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </CollapsibleCard>
  );
}

// CIEL-PUBLIC-V1-PAGES aspects applied

// CIEL-I18N-V1 AspectsList applied
