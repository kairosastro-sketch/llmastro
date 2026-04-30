// ============================================================
// ARCHIVE-KAIROS-TRACE-V1 — KairosTrace component
// ------------------------------------------------------------
// "Show your work" sur les lectures IA. Composant réutilisable.
// Affiche :
//   1. Disclaimer IA proéminent (xAI Grok, calculs vérifiables)
//   2. Tiroir <details> avec les positions natales et les
//      transits du moment qui ont nourri la lecture
//   3. Lien vers /methode#kairos, /limites, /dashboard/natal/[id]
// ------------------------------------------------------------
// Réutilisable : props optionnelles, dégrade proprement si data
// manquante. Conçu pour horoscope / tarot / natal-profile / chat.
// ============================================================

"use client";

import Link from "next/link";
import { SourceAttribution } from "@/components/bibliography/SourceAttribution";

// ──────────────────────────────────────────────────────────
// Types — souples car les chart d'origine sont typés `any`
// dans le reste du codebase (cf. /dashboard/natal/[id]/page.tsx)
// ──────────────────────────────────────────────────────────

interface NatalLike {
  planets?: Record<
    string,
    {
      signIdx?: number;
      sign?: string;
      signDegree?: number;
      house?: number;
      retrograde?: boolean;
    }
  > | Array<{
      planet?: string;
      signIdx?: number;
      sign?: string;
      signDegree?: number;
      house?: number;
      retrograde?: boolean;
    }>;
}

interface MoonPhaseLike {
  emoji?: string;
  phase?: string;
  description?: string;
  illumination?: number;
}

export interface KairosTraceProps {
  /** Type de lecture (pour adapter le wording du disclaimer) */
  readingKind?: "horoscope" | "tarot" | "natal-profile" | "chat" | "generic";
  /** Données natales (depuis /horoscope/daily ou /ai/* meta) */
  natal?: NatalLike | null;
  /** Phase lunaire actuelle (pour les lectures avec transits du jour) */
  moonPhase?: MoonPhaseLike | null;
  /** Alertes rétrogrades (strings prêtes à afficher) */
  alerts?: string[];
  /** L'heure de naissance est-elle connue ? */
  birthTimeKnown?: boolean;
  /** ID du profil natal pour le lien fiche technique */
  natalId?: string | null;
  /** Locale utilisateur (fr / en) */
  locale?: string;
  /** Visible uniquement si une lecture a été chargée (pas pendant loading) */
  hasReading?: boolean;
  /** Types d'aspects présents dans la lecture (pour SourceAttribution) */
  aspectTypes?: string[];
}

// ──────────────────────────────────────────────────────────
// Mappings glyphes
// ──────────────────────────────────────────────────────────

const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  northnode: "☊", chiron: "⚷", lilith: "⚸",
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  NorthNode: "☊", Chiron: "⚷", Lilith: "⚸",
};

const SIGN_GLYPHS_BY_IDX: Record<number, string> = {
  0: "♈", 1: "♉", 2: "♊", 3: "♋", 4: "♌", 5: "♍",
  6: "♎", 7: "♏", 8: "♐", 9: "♑", 10: "♒", 11: "♓",
};

const SIGN_NAMES_FR_BY_IDX: Record<number, string> = {
  0: "Bélier", 1: "Taureau", 2: "Gémeaux", 3: "Cancer",
  4: "Lion", 5: "Vierge", 6: "Balance", 7: "Scorpion",
  8: "Sagittaire", 9: "Capricorne", 10: "Verseau", 11: "Poissons",
};

const SIGN_NAMES_EN_BY_IDX: Record<number, string> = {
  0: "Aries", 1: "Taurus", 2: "Gemini", 3: "Cancer",
  4: "Leo", 5: "Virgo", 6: "Libra", 7: "Scorpio",
  8: "Sagittarius", 9: "Capricorn", 10: "Aquarius", 11: "Pisces",
};

const PLANET_LABELS_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturne",
};

const PLANET_LABELS_EN: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturn",
};

// "Majeurs" : Soleil → Saturne (les 7 visibles à l'œil nu).
// Cohérent avec l'usage horoscopique courant.
const MAJOR_PLANET_KEYS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

interface NormalizedPlanet {
  key: string;
  label: string;
  glyph: string;
  signIdx: number | null;
  signGlyph: string;
  signName: string;
  signDegree: number | null;
  house: number | null;
  retrograde: boolean;
}

function normalizePlanets(natal: NatalLike | null | undefined, locale: string): NormalizedPlanet[] {
  if (!natal?.planets) return [];

  // Le shape de natal.planets varie selon les sources :
  //   - /horoscope/daily : objet { sun: {...}, moon: {...} } (clés en lower)
  //   - /api/natal       : tableau [{ planet: "Sun", ... }, ...]
  // On gère les deux et on filtre sur les majeurs.
  const entries: Array<[string, any]> = Array.isArray(natal.planets)
    ? natal.planets.map((p: any) => [String(p.planet ?? "").toLowerCase(), p])
    : Object.entries(natal.planets).map(([k, v]) => [k.toLowerCase(), v]);

  const labels = locale === "en" ? PLANET_LABELS_EN : PLANET_LABELS_FR;
  const signNames = locale === "en" ? SIGN_NAMES_EN_BY_IDX : SIGN_NAMES_FR_BY_IDX;

  const result: NormalizedPlanet[] = [];

  for (const key of MAJOR_PLANET_KEYS) {
    const entry = entries.find(([k]) => k === key);
    if (!entry) continue;
    const p = entry[1];

    let signIdx: number | null =
      typeof p?.signIdx === "number"
        ? p.signIdx
        : typeof p?.sign === "string"
        ? signNameToIdx(p.sign)
        : null;

    result.push({
      key,
      label: labels[key] ?? key,
      glyph: PLANET_GLYPHS[key] ?? "✦",
      signIdx,
      signGlyph: signIdx !== null ? SIGN_GLYPHS_BY_IDX[signIdx] ?? "" : "",
      signName: signIdx !== null ? signNames[signIdx] ?? "" : "",
      signDegree: typeof p?.signDegree === "number" ? p.signDegree : null,
      house: typeof p?.house === "number" ? p.house : null,
      retrograde: Boolean(p?.retrograde),
    });
  }

  return result;
}

function signNameToIdx(name: string): number | null {
  const all = [
    ["aries", "bélier", "belier"],
    ["taurus", "taureau"],
    ["gemini", "gémeaux", "gemeaux"],
    ["cancer"],
    ["leo", "lion"],
    ["virgo", "vierge"],
    ["libra", "balance"],
    ["scorpio", "scorpion"],
    ["sagittarius", "sagittaire"],
    ["capricorn", "capricorne"],
    ["aquarius", "verseau"],
    ["pisces", "poissons"],
  ];
  const lower = name.toLowerCase().trim();
  for (let i = 0; i < all.length; i++) {
    if (all[i].includes(lower)) return i;
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// Wording du disclaimer selon le type de lecture
// ──────────────────────────────────────────────────────────

function disclaimerText(kind: KairosTraceProps["readingKind"], locale: string): {
  intro: string;
  caveat: string;
  ref: string;
} {
  const isFr = locale !== "en";

  if (isFr) {
    const introByKind: Record<string, string> = {
      "horoscope":
        "Cette lecture a été générée par xAI Grok à partir des positions astrologiques calculées de votre thème natal et des transits du moment.",
      "tarot":
        "Cette interprétation a été générée par xAI Grok en croisant les cartes tirées et, le cas échéant, votre thème natal.",
      "natal-profile":
        "Ce profil natal a été généré par xAI Grok à partir des positions astrologiques calculées de votre thème.",
      "chat":
        "Cette réponse a été générée par xAI Grok dans le contexte de votre thème natal.",
      "generic":
        "Ce contenu a été généré par xAI Grok à partir des données astrologiques calculées.",
    };
    return {
      intro: introByKind[kind ?? "generic"] ?? introByKind.generic,
      caveat:
        "Le texte est génératif et peut comporter des imprécisions, particulièrement sur les configurations rares. Les calculs sous-jacents, eux, restent vérifiables.",
      ref: "Voir la méthode et les limites assumées",
    };
  }

  const introByKindEn: Record<string, string> = {
    "horoscope":
      "This reading was generated by xAI Grok from the calculated astrological positions of your natal chart and current transits.",
    "tarot":
      "This interpretation was generated by xAI Grok from the drawn cards and, if available, your natal chart.",
    "natal-profile":
      "This natal profile was generated by xAI Grok from the calculated astrological positions of your chart.",
    "chat":
      "This response was generated by xAI Grok in the context of your natal chart.",
    "generic":
      "This content was generated by xAI Grok from calculated astrological data.",
  };
  return {
    intro: introByKindEn[kind ?? "generic"] ?? introByKindEn.generic,
    caveat:
      "The text is generative and may include inaccuracies, especially on rare configurations. The underlying calculations remain verifiable.",
    ref: "See the method and assumed limits",
  };
}

// ──────────────────────────────────────────────────────────
// Composant
// ──────────────────────────────────────────────────────────

export function KairosTrace({
  readingKind = "generic",
  natal,
  moonPhase,
  alerts,
  birthTimeKnown,
  natalId,
  locale = "fr",
  hasReading = true,
  aspectTypes = [],
}: KairosTraceProps) {
  if (!hasReading) return null;

  const isFr = locale !== "en";
  const planets = normalizePlanets(natal ?? null, locale);
  const dis = disclaimerText(readingKind, locale);

  const labelMethode = isFr ? "Méthode" : "Method";
  const labelLimites = isFr ? "Limites" : "Limits";
  const labelFiche = isFr ? "Voir la fiche technique complète" : "See the full technical sheet";
  const labelToggle = isFr ? "Voir les données utilisées par cette lecture" : "View the data used for this reading";
  const labelPositions = isFr ? "Positions natales (planètes majeures)" : "Natal positions (major planets)";
  const labelTransits = isFr ? "Ciel du moment" : "Current sky";
  const labelTimeUnknown = isFr ? "Heure de naissance approchée" : "Approximate birth time";
  const labelTimeUnknownDesc = isFr
    ? "L'ascendant et les maisons sont calculés à 12:00 par défaut — interprétez les analyses qui en dépendent avec recul."
    : "Ascendant and houses are computed at 12:00 by default — interpret related analyses cautiously.";
  const labelNoData = isFr ? "Données natales non disponibles dans le contexte de cette lecture." : "Natal data not available in this reading context.";

  return (
    <div
      className="card"
      style={{
        marginTop: 18,
        borderLeft: "3px solid var(--gold)",
        background: "rgba(201,168,76,0.04)",
      }}
    >
      {/* ============ DISCLAIMER IA ============ */}
      <div style={{ padding: "4px 0 10px 0" }}>
        <div
          style={{
            fontSize: 10,
            color: "var(--gold)",
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: 8,
          }}
        >
          {isFr ? "Comment cette lecture a été produite" : "How this reading was produced"}
        </div>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12.5,
            lineHeight: 1.65,
            color: "var(--star)",
            marginBottom: 6,
          }}
        >
          {dis.intro}
        </p>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--muted)",
          }}
        >
          {dis.caveat}
        </p>
      </div>

      {/* ============ AVERTISSEMENT HEURE INCONNUE ============ */}
      {birthTimeKnown === false && (
        <div
          style={{
            background: "rgba(212, 168, 67, 0.08)",
            border: "1px solid rgba(212, 168, 67, 0.3)",
            borderRadius: 6,
            padding: "8px 12px",
            marginTop: 8,
            marginBottom: 4,
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--gold)",
          }}
        >
          <strong>{labelTimeUnknown}.</strong>{" "}
          <span style={{ color: "var(--muted)" }}>{labelTimeUnknownDesc}</span>
        </div>
      )}

      {/* ============ TIROIR DONNÉES UTILISÉES ============ */}
      <details
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(201,168,76,0.12)",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontFamily: "var(--font-display)",
            fontSize: 12.5,
            color: "var(--gold)",
            letterSpacing: 0.3,
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 0",
            userSelect: "none",
          }}
        >
          <span>🔭</span>
          <span>{labelToggle}</span>
        </summary>

        <div style={{ marginTop: 10, paddingTop: 6 }}>
          {/* ── Positions natales ── */}
          {planets.length > 0 ? (
            <>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                {labelPositions}
              </div>
              <div style={{ overflowX: "auto", marginBottom: 14 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                    fontFamily: "var(--font-display)",
                  }}
                >
                  <tbody>
                    {planets.map((p) => (
                      <tr
                        key={p.key}
                        style={{ borderBottom: "1px solid rgba(201,168,76,0.06)" }}
                      >
                        <td style={{ padding: "6px 8px", color: "var(--star)", width: "30%" }}>
                          <span style={{ marginRight: 6, opacity: 0.85 }}>{p.glyph}</span>
                          {p.label}
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--star)", opacity: 0.9 }}>
                          {p.signGlyph} {p.signName}
                          {p.signDegree !== null && (
                            <span
                              style={{
                                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                                fontSize: 11,
                                color: "var(--muted)",
                                marginLeft: 6,
                              }}
                            >
                              {p.signDegree.toFixed(1)}°
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "6px 8px",
                            color: "var(--muted)",
                            fontSize: 11,
                            textAlign: "right",
                            width: "20%",
                          }}
                        >
                          {p.house !== null ? (isFr ? `Maison ${p.house}` : `House ${p.house}`) : ""}
                          {p.retrograde && (
                            <span style={{ color: "var(--tension)", marginLeft: 6 }}>℞</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                fontStyle: "italic",
                marginBottom: 12,
              }}
            >
              {labelNoData}
            </p>
          )}

          {/* ── Ciel du moment (transits) ── */}
          {(moonPhase || (alerts && alerts.length > 0)) && (
            <>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                {labelTransits}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginBottom: 12,
                  fontSize: 12,
                  color: "var(--star)",
                  opacity: 0.9,
                }}
              >
                {moonPhase && (
                  <div>
                    <span style={{ marginRight: 6 }}>{moonPhase.emoji ?? "☽"}</span>
                    <strong>{moonPhase.phase}</strong>
                    {moonPhase.description && (
                      <span style={{ color: "var(--muted)", marginLeft: 6 }}>
                        — {moonPhase.description}
                      </span>
                    )}
                  </div>
                )}
                {alerts?.map((a, i) => (
                  <div key={i}>
                    <span style={{ marginRight: 6, color: "var(--gold)" }}>⟲</span>
                    {a}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Lien fiche technique ── */}
          {natalId && (
            <div style={{ marginTop: 8 }}>
              <Link
                href={`/dashboard/natal/${natalId}`}
                style={{
                  fontSize: 11.5,
                  color: "var(--gold)",
                  borderBottom: "1px solid currentColor",
                  paddingBottom: 1,
                }}
              >
                {labelFiche} →
              </Link>
            </div>
          )}
        </div>
      </details>

      {/* ============ ATTRIBUTION DES SOURCES ============ */}
      <SourceAttribution
        planets={planets.map((p) => p.key)}
        aspectTypes={aspectTypes}
        locale={locale}
      />

      {/* ============ FOOTER LIENS ============ */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(201,168,76,0.12)",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        <span>{dis.ref}&nbsp;:</span>
        <Link
          href="/methode"
          style={{ color: "var(--gold)", borderBottom: "1px solid currentColor" }}
        >
          {labelMethode}
        </Link>
        <Link
          href="/limites"
          style={{ color: "var(--gold)", borderBottom: "1px solid currentColor" }}
        >
          {labelLimites}
        </Link>
      </div>
    </div>
  );
}

// ARCHIVE-KAIROS-TRACE-V1 applied

// ARCHIVE-BIBLIOGRAPHY-V1 applied
