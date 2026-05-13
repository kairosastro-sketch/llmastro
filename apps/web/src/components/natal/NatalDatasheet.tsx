// ============================================================
// ARCHIVE-NATAL-DATASHEET-V1 — NatalDatasheet component
// ------------------------------------------------------------
// Fiche imprimable complète d'un thème natal.
// Pensée pour Cmd+P / Ctrl+P → "Save as PDF" du navigateur.
// CSS @media print pour masquer chrome (boutons, etc.).
// ============================================================

"use client";

import { ZodiacWheel, type WheelPlanet } from "@/components/ui/ZodiacWheel";
import { TechnicalDetails } from "@/components/natal/TechnicalDetails";
import { useApp } from "@/lib/i18n";
import { getLocalizedMoonPhase } from "@/lib/i18n/moon-phase";

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────

const SIGN_NAMES_BY_IDX: string[] = [
  "Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
  "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons",
];

const SIGN_GLYPHS_BY_IDX: string[] = [
  "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓",
];

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  NorthNode: "☊", SouthNode: "☋", Chiron: "⚷", Lilith: "⚸", Fortune: "⊕",
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  northNode: "☊", southNode: "☋", chiron: "⚷", lilith: "⚸", fortune: "⊕",
};

const PLANET_LABEL_FR: Record<string, string> = {
  Sun: "Soleil", Moon: "Lune", Mercury: "Mercure", Venus: "Vénus", Mars: "Mars",
  Jupiter: "Jupiter", Saturn: "Saturne", Uranus: "Uranus", Neptune: "Neptune",
  Pluto: "Pluton", NorthNode: "Nœud Nord", SouthNode: "Nœud Sud",
  Chiron: "Chiron", Lilith: "Lilith", Fortune: "Part de Fortune",
};

const PLANET_COLORS: Record<string, string> = {
  sun: "#d4a843", moon: "#b0adc8", mercury: "#60a5fa", venus: "#e879a8",
  mars: "#f87171", jupiter: "#34d399", saturn: "#a78bfa",
  uranus: "#67e8f9", neptune: "#818cf8", pluto: "#c4b5fd",
  // LILITH-V1
  lilith: "#9f7aea", northNode: "#fbbf24", southNode: "#a8a29e",
};

const ASPECT_GLYPHS: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□",
  trine: "△", opposition: "☍", quincunx: "⚻",
};

const ASPECT_TYPE_FR: Record<string, string> = {
  conjunction: "Conjonction", sextile: "Sextile", square: "Carré",
  trine: "Trigone", opposition: "Opposition", quincunx: "Quinconce",
};

const ASPECT_TONE_COLOR: Record<string, string> = {
  h: "var(--harmony)",
  t: "var(--tension)",
  n: "var(--gold)",
};

// ──────────────────────────────────────────────────────────
// Helpers — dupliqués depuis [id]/page.tsx volontairement
// pour rester self-contained.
// ──────────────────────────────────────────────────────────

function toArrayShape(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>);
  return [];
}

function enrichPlanet(p: any, fallbackKey: string | null): any {
  if (!p || typeof p !== "object") return p;
  const PLANET_NAME_FROM_KEY: Record<string, string> = {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
    jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune",
    pluto: "Pluto", northnode: "NorthNode", northNode: "NorthNode",
    southnode: "SouthNode", southNode: "SouthNode",
    chiron: "Chiron", lilith: "Lilith", fortune: "Fortune",
  };
  const planetName: string =
    p.planet ??
    (fallbackKey ? PLANET_NAME_FROM_KEY[fallbackKey] ?? PLANET_NAME_FROM_KEY[fallbackKey.toLowerCase()] ?? fallbackKey : "?");

  const SIGN_NAMES_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
  const SIGN_EN_TO_FR: Record<string, string> = {
    Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer",
    Leo: "Lion", Virgo: "Vierge", Libra: "Balance", Scorpio: "Scorpion",
    Sagittarius: "Sagittaire", Capricorn: "Capricorne", Aquarius: "Verseau", Pisces: "Poissons",
  };
  const dsSignEn = (typeof p.sign === "string") ? SIGN_EN_TO_FR[p.sign] : undefined;
  const sign: string | undefined =
    dsSignEn ??
    p.sign ??
    (typeof p.signIdx === "number" ? SIGN_NAMES_FR[p.signIdx] : undefined);

  const signDegree: number | undefined =
    typeof p.signDegree === "number" ? p.signDegree :
    typeof p.degree === "number" ? p.degree :
    typeof p.longitude === "number" ? p.longitude % 30 : undefined;

  return { ...p, planet: planetName, sign, signDegree };
}

function enrichHouse(h: any, fallbackIdx: number): any {
  if (!h || typeof h !== "object") return h;
  const houseNumber: number | undefined =
    typeof h.house === "number" ? h.house :
    typeof h.number === "number" ? h.number : fallbackIdx + 1;

  const SIGN_NAMES_FR = ["Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge","Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons"];
  const SIGN_EN_TO_FR_H: Record<string, string> = {
    Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer",
    Leo: "Lion", Virgo: "Vierge", Libra: "Balance", Scorpio: "Scorpion",
    Sagittarius: "Sagittaire", Capricorn: "Capricorne", Aquarius: "Verseau", Pisces: "Poissons",
  };
  const dsHouseSignEn = (typeof h.sign === "string") ? SIGN_EN_TO_FR_H[h.sign] : undefined;
  const sign: string | undefined =
    dsHouseSignEn ??
    h.sign ??
    (typeof h.signIdx === "number" ? SIGN_NAMES_FR[h.signIdx] : undefined);

  const signDegree: number | undefined =
    typeof h.signDegree === "number" ? h.signDegree :
    typeof h.longitude === "number" ? h.longitude % 30 : undefined;

  return { ...h, house: houseNumber, sign, signDegree };
}

function normalizeChart(chart: any): any {
  if (!chart || typeof chart !== "object") return chart;
  let planets: any[] = [];
  if (Array.isArray(chart.planets)) {
    planets = chart.planets.map((p: any) => enrichPlanet(p, p?.planet ?? p?.key ?? null));
  } else if (chart.planets && typeof chart.planets === "object") {
    planets = Object.entries(chart.planets as Record<string, any>).map(
      ([key, p]) => enrichPlanet(p, key),
    );
  }
  let houses: any[] = [];
  if (Array.isArray(chart.houses)) {
    houses = chart.houses.map((h: any, i: number) => enrichHouse(h, i));
  } else if (chart.houses && typeof chart.houses === "object") {
    houses = Object.entries(chart.houses as Record<string, any>).map(([_key, h], i) => enrichHouse(h, i));
  }
  return {
    ...chart,
    planets,
    houses,
    aspects: toArrayShape(chart.aspects),
  };
}

// ──────────────────────────────────────────────────────────
// Helpers d'affichage
// ──────────────────────────────────────────────────────────

function signFromIdx(idx: number | undefined): { name: string; glyph: string } {
  if (typeof idx !== "number" || idx < 0 || idx > 11) return { name: "—", glyph: "" };
  return { name: SIGN_NAMES_BY_IDX[idx], glyph: SIGN_GLYPHS_BY_IDX[idx] };
}

function formatDegree(deg: number | undefined): string {
  if (typeof deg !== "number" || Number.isNaN(deg)) return "—";
  return deg.toFixed(2) + "°";
}

function findPlanet(planets: any[], name: string): any | null {
  return planets.find((p) => p?.planet?.toLowerCase() === name.toLowerCase()) ?? null;
}

// ──────────────────────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────────────────────

interface NatalDatasheetProps {
  profile: any;
  chart: any;
}

export function NatalDatasheet({ profile, chart: rawChart }: NatalDatasheetProps) {
  const { locale } = useApp();
  const lang = locale === "en" ? "en" : "fr";
  const chart = normalizeChart(rawChart);
  const planets: any[] = chart?.planets ?? [];
  const houses: any[] = chart?.houses ?? [];
  const aspects: any[] = chart?.aspects ?? [];
  const moonPhase = chart?.moonPhase;

  // Big Three : Soleil, Lune, Ascendant
  const sunP = findPlanet(planets, "Sun");
  const moonP = findPlanet(planets, "Moon");
  // Asc : signe d'apparition de l'ascendant ≈ asc / 30
  const ascDeg: number | undefined = typeof chart?.asc === "number" ? chart.asc : undefined;
  const ascSignIdx: number | undefined = typeof ascDeg === "number" ? Math.floor(ascDeg / 30) : undefined;
  const ascSign = signFromIdx(ascSignIdx);
  const ascDegInSign = typeof ascDeg === "number" ? ascDeg % 30 : undefined;

  // Préparation des planètes pour la roue (composant existant)
  const wheelPlanets: WheelPlanet[] = planets
    .filter((p) => typeof p?.longitude === "number")
    .map((p) => {
      const keyLower = String(p.planet ?? p.key ?? "").toLowerCase();
      return {
        name: keyLower,
        glyph: PLANET_GLYPHS[p.planet] ?? PLANET_GLYPHS[keyLower] ?? "✦",
        longitude: p.longitude,
        retrograde: !!p.retrograde,
        color: PLANET_COLORS[keyLower],
      };
    });

  // Aspects : top 15 par orbe serré (cohérent avec [id]/page.tsx)
  const topAspects = [...aspects]
    .filter((a) => a && typeof a.orb === "number")
    .sort((a, b) => (a.orb ?? 99) - (b.orb ?? 99))
    .slice(0, 15);

  return (
    <>
      {/* CSS @media print et ajustements globaux */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #ffffff !important; }
          .datasheet-root { padding: 0 !important; max-width: 100% !important; }
          .datasheet-section { page-break-inside: avoid; break-inside: avoid; }
          .datasheet-page-break { page-break-after: always; break-after: page; }
        }
        @page {
          margin: 18mm 14mm;
        }
      `}</style>

      <div
        className="datasheet-root"
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "32px 20px 80px",
          fontFamily: "var(--font-display)",
        }}
      >
        {/* ============ HEADER ============ */}
        <div
          className="datasheet-section"
          style={{ marginBottom: 24, borderBottom: "2px solid var(--gold)", paddingBottom: 16 }}
        >
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--muted)", marginBottom: 4 }}>
                Fiche technique du thème natal
              </div>
              <h1 style={{ fontSize: 28, color: "var(--gold)", margin: 0, lineHeight: 1.15 }}>
                {profile?.label ?? profile?.name ?? "Thème natal"}
              </h1>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => window.print()}
                className="btn-ghost"
                style={{ fontSize: 12 }}
              >
                🖨 Imprimer / Sauvegarder en PDF
              </button>
            </div>
          </div>
        </div>

        {/* ============ IDENTITÉ ============ */}
        <Section title="Identité">
          <Grid2>
            <Field label="Nom" value={profile?.label ?? profile?.name ?? "—"} />
            <Field label="Date de naissance" value={profile?.birthDate ?? "—"} />
            <Field
              label="Heure"
              value={
                profile?.birthTimeUnknown
                  ? "Inconnue (calcul à 12:00)"
                  : profile?.birthTime ?? "—"
              }
            />
            <Field
              label="Lieu"
              value={
                [profile?.birthCity, profile?.birthCountry].filter(Boolean).join(", ") || "—"
              }
            />
          </Grid2>

          {/* Big Three */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16, marginTop: 20,
          }}>
            <BigThreeCard
              label="Soleil"
              glyph="☉"
              sign={sunP?.sign ? signFromIdxName(sunP.sign) : { name: "—", glyph: "" }}
              degree={sunP?.signDegree}
              house={sunP?.house}
            />
            <BigThreeCard
              label="Lune"
              glyph="☽"
              sign={moonP?.sign ? signFromIdxName(moonP.sign) : { name: "—", glyph: "" }}
              degree={moonP?.signDegree}
              house={moonP?.house}
            />
            <BigThreeCard
              label="Ascendant"
              glyph="✦"
              sign={ascSign}
              degree={ascDegInSign}
              house={1}
            />
          </div>
        </Section>

        {/* ============ ROUE ZODIACALE ============ */}
        <Section title="Roue zodiacale">
          <div style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "var(--r-lg)",
            padding: 16,
            display: "flex",
            justifyContent: "center",
          }}>
            <ZodiacWheel
              planets={wheelPlanets.length > 0 ? wheelPlanets : undefined}
              ascendant={ascDeg ?? 0}
              chartName={profile?.label ?? "Thème natal"}
              showHouses={true}
              showAspects={true}
              showPlanets={true}
            />
          </div>
        </Section>

        {/* ============ POSITIONS PLANÉTAIRES ============ */}
        <Section title="Positions planétaires">
          <DataTable
            head={["Corps", "Signe", "Degré", "Maison", "Statut"]}
            rows={planets.map((p) => {
              const sg = p.sign ? signFromIdxName(p.sign) : { name: "—", glyph: "" };
              return [
                <span><span style={{ marginRight: 6, opacity: 0.85 }}>{PLANET_GLYPHS[p.planet] ?? "✦"}</span>{PLANET_LABEL_FR[p.planet] ?? p.planet}</span>,
                <span>{sg.glyph} {sg.name}</span>,
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{formatDegree(p.signDegree)}</span>,
                <span>{typeof p.house === "number" ? p.house : "—"}</span>,
                p.retrograde ? <span style={{ color: "var(--tension)" }}>℞ Rétrograde</span> : <span style={{ color: "var(--harmony)" }}>Direct</span>,
              ];
            })}
          />
        </Section>

        {/* ============ MAISONS ============ */}
        <Section title="Maisons">
          <DataTable
            head={["Maison", "Cuspide (signe)", "Degré"]}
            rows={houses.map((h) => {
              const sg = h.sign ? signFromIdxName(h.sign) : { name: "—", glyph: "" };
              return [
                <strong>Maison {h.house}</strong>,
                <span>{sg.glyph} {sg.name}</span>,
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{formatDegree(h.signDegree)}</span>,
              ];
            })}
          />
        </Section>

        {/* ============ ASPECTS ============ */}
        <Section title={`Aspects principaux (${topAspects.length} par orbe serré)`}>
          {topAspects.length > 0 ? (
            <DataTable
              head={["P1", "Aspect", "P2", "Type", "Orbe", "État"]}
              rows={topAspects.map((a) => {
                const tone = a.tone ?? "n";
                const glyph = ASPECT_GLYPHS[a.type] ?? "—";
                const typeLabel = ASPECT_TYPE_FR[a.type] ?? a.type;
                return [
                  <span><span style={{ marginRight: 4, opacity: 0.85 }}>{PLANET_GLYPHS[a.planet1] ?? PLANET_GLYPHS[(a.planet1 ?? "").toLowerCase()] ?? ""}</span>{PLANET_LABEL_FR[capitalize(a.planet1)] ?? a.planet1}</span>,
                  <span style={{ color: ASPECT_TONE_COLOR[tone] ?? "var(--gold)", fontSize: 16 }}>{glyph}</span>,
                  <span><span style={{ marginRight: 4, opacity: 0.85 }}>{PLANET_GLYPHS[a.planet2] ?? PLANET_GLYPHS[(a.planet2 ?? "").toLowerCase()] ?? ""}</span>{PLANET_LABEL_FR[capitalize(a.planet2)] ?? a.planet2}</span>,
                  <span>{typeLabel}</span>,
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{formatDegree(a.orb)}</span>,
                  <span style={{ color: a.applying ? "var(--harmony)" : "var(--muted)", fontSize: 11 }}>
                    {a.applying ? "Applicatif" : "Séparatif"}
                  </span>,
                ];
              })}
            />
          ) : (
            <p style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 13 }}>
              Aucun aspect majeur détecté.
            </p>
          )}
        </Section>

        {/* ============ PHASE LUNAIRE ============ */}
        {moonPhase && (
          <Section title="Phase lunaire à la naissance">
            <div style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: 14,
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--r-lg)",
            }}>
              <span style={{ fontSize: 36, lineHeight: 1 }}>{moonPhase.emoji ?? "☽"}</span>
              <div>
                <div style={{ fontSize: 16, color: "var(--gold)", marginBottom: 4 }}>
                  {getLocalizedMoonPhase(moonPhase.key, lang)?.phase ?? moonPhase.phase}
                  {typeof moonPhase.illumination === "number" ? (
                    <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>
                      ({Math.round(moonPhase.illumination * 100)}% illuminée)
                    </span>
                  ) : null}
                </div>
                {moonPhase.description && (
                  <div style={{ fontSize: 12.5, color: "var(--star)", opacity: 0.8, lineHeight: 1.5 }}>
                    {getLocalizedMoonPhase(moonPhase.key, lang)?.description ?? moonPhase.description}
                  </div>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* ============ MÉTADONNÉES TECHNIQUES ============ */}
        <Section title="Métadonnées du calcul">
          <TechnicalDetails chart={chart} />
        </Section>

        {/* ============ DISCLAIMER FOOTER ============ */}
        <div
          className="datasheet-section"
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: "1px solid var(--border-soft)",
            fontSize: 10.5,
            color: "var(--muted)",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          <p style={{ marginBottom: 6 }}>
            <strong style={{ color: "var(--gold)" }}>Llmastro</strong> · Fiche générée le {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <p style={{ marginBottom: 6 }}>
            Calculs Swiss Ephemeris (tables JPL DE431 NASA). Voir <em>llmastro.com/methode</em> et <em>llmastro.com/limites</em>.
          </p>
          <p style={{ fontSize: 9.5, opacity: 0.75 }}>
            L'astrologie n'est pas validée scientifiquement. Cette fiche est un outil symbolique, à ne pas utiliser comme aide médicale ou prédictive.
          </p>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="datasheet-section" style={{ marginBottom: 28 }}>
      <h2 style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "2px",
        color: "var(--gold)",
        margin: "0 0 12px 0",
        paddingBottom: 6,
        borderBottom: "1px solid var(--border-soft)",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "10px 24px",
    }}>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontSize: 9.5,
        textTransform: "uppercase",
        letterSpacing: "1px",
        color: "var(--muted)",
        marginBottom: 2,
        fontFamily: "var(--font-body)",
      }}>{label}</div>
      <div style={{ fontSize: 14, color: "var(--star)" }}>{value}</div>
    </div>
  );
}

function BigThreeCard({
  label, glyph, sign, degree, house,
}: {
  label: string;
  glyph: string;
  sign: { name: string; glyph: string };
  degree: number | undefined;
  house: number | undefined;
}) {
  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: "var(--r-lg)",
      padding: "12px 14px",
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "var(--muted)",
        marginBottom: 4,
        fontFamily: "var(--font-body)",
      }}>{label}</div>
      <div style={{ fontSize: 22, color: "var(--gold)", marginBottom: 2 }}>
        {glyph} {sign.glyph}
      </div>
      <div style={{ fontSize: 13, color: "var(--star)", marginBottom: 2 }}>
        {sign.name}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
        {formatDegree(degree)}{typeof house === "number" ? ` · M${house}` : ""}
      </div>
    </div>
  );
}

function DataTable({
  head, rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: "var(--font-display)",
      }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={{
                textAlign: "left",
                padding: "8px 10px 8px 0",
                borderBottom: "1.5px solid var(--gold)",
                fontSize: 9.5,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "var(--gold)",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: "7px 10px 7px 0",
                  fontSize: 12.5,
                  color: "var(--star)",
                  verticalAlign: "middle",
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────────────────

function capitalize(s: any): string {
  const str = String(s ?? "");
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// signe (EN ou FR) → glyph + nom FR
function signFromIdxName(signAny: string): { name: string; glyph: string } {
  const SIGN_NAMES_EN = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  // SIGN_NAMES_BY_IDX est déjà en FR au top du fichier
  let idx = SIGN_NAMES_BY_IDX.indexOf(signAny);
  if (idx < 0) idx = SIGN_NAMES_EN.indexOf(signAny);
  return signFromIdx(idx >= 0 ? idx : undefined);
}

// ARCHIVE-NATAL-DATASHEET-V1 applied

// ARCHIVE-NATAL-I18N-FR-V1 applied
