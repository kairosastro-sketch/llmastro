// ============================================================
// apps/web/src/components/ciel/AspectsList.tsx
// CIEL-PUBLIC-V1-PAGES
// ============================================================

import type { TransitAspect } from "@/lib/server/sky-fetch";

const PLANET_NAMES_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
  uranus: "Uranus", neptune: "Neptune", pluto: "Pluton",
  northNode: "Nœud Nord", southNode: "Nœud Sud",
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
  /** Combien d'aspects afficher (par priorité décroissante). Default 8. */
  top?: number;
}

export function AspectsList({ aspects, top = 8 }: AspectsListProps) {
  const items = (aspects ?? []).slice(0, top);
  if (items.length === 0) {
    return (
      <section className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={sectionTitle}>Aspects mutuels</h2>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Pas d'aspect majeur en cours.
        </p>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
      <h2 style={sectionTitle}>
        Aspects mutuels{aspects.length > top ? ` — top ${top} (sur ${aspects.length})` : ""}
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((a, i) => {
          const tName = PLANET_NAMES_FR[a.transitPlanet] ?? a.transitPlanet;
          const nName = PLANET_NAMES_FR[a.natalPlanet]   ?? a.natalPlanet;
          const tGlyph = PLANET_GLYPHS[a.transitPlanet] ?? "";
          const nGlyph = PLANET_GLYPHS[a.natalPlanet]   ?? "";
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
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {a.typeFr.toLowerCase()}
              </span>
              <span style={{ minWidth: "1.2em", color: "var(--gold)" }} aria-hidden>{nGlyph}</span>
              <span style={{ color: "var(--gold-l)" }}>{nName}</span>
              <span
                style={{
                  marginLeft: "auto",
                  color: a.exact ? "var(--gold)" : "var(--muted-2)",
                  fontSize: "0.8rem",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                orbe {a.orb}°{a.exact ? " · exact" : a.tight ? " · serré" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.3rem",
  fontWeight: 400,
  color: "var(--gold)",
  margin: "0 0 1rem",
};

// CIEL-PUBLIC-V1-PAGES aspects applied
