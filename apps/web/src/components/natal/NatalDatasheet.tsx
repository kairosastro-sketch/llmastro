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
// DIGNITES-V1
import { computeDignity, type DignityKind, type DignityResult } from "@/lib/astro-dignities";

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────

const SIGN_NAMES_BY_IDX: string[] = [
  "Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge",
  "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons",
];

const SIGN_NAMES_EN_BY_IDX: string[] = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const SIGN_GLYPHS_BY_IDX: string[] = [
  "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓",
];

type Lang = "fr" | "en";

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  NorthNode: "☊", SouthNode: "☋", Chiron: "⚷", Lilith: "⚸", Fortune: "⊕",
  // ASTEROIDS-V1 : glyphes astrologiques standard.
  Ceres: "⚳", Pallas: "⚴", Juno: "⚵", Vesta: "⚶", LilithTrue: "⚸",
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
  northNode: "☊", southNode: "☋", chiron: "⚷", lilith: "⚸", fortune: "⊕",
  ceres: "⚳", pallas: "⚴", juno: "⚵", vesta: "⚶", lilithTrue: "⚸",
};

const PLANET_LABEL_FR: Record<string, string> = {
  Sun: "Soleil", Moon: "Lune", Mercury: "Mercure", Venus: "Vénus", Mars: "Mars",
  Jupiter: "Jupiter", Saturn: "Saturne", Uranus: "Uranus", Neptune: "Neptune",
  Pluto: "Pluton", NorthNode: "Nœud Nord", SouthNode: "Nœud Sud",
  Chiron: "Chiron", Lilith: "Lilith", Fortune: "Part de Fortune",
  // ASTEROIDS-V1
  Ceres: "Cérès", Pallas: "Pallas", Juno: "Junon", Vesta: "Vesta",
  LilithTrue: "Lilith vraie",
};

const PLANET_LABEL_EN: Record<string, string> = {
  Sun: "Sun", Moon: "Moon", Mercury: "Mercury", Venus: "Venus", Mars: "Mars",
  Jupiter: "Jupiter", Saturn: "Saturn", Uranus: "Uranus", Neptune: "Neptune",
  Pluto: "Pluto", NorthNode: "North Node", SouthNode: "South Node",
  Chiron: "Chiron", Lilith: "Lilith", Fortune: "Part of Fortune",
  // ASTEROIDS-V1
  Ceres: "Ceres", Pallas: "Pallas", Juno: "Juno", Vesta: "Vesta",
  LilithTrue: "True Lilith",
};

const PLANET_LABELS: Record<Lang, Record<string, string>> = {
  fr: PLANET_LABEL_FR,
  en: PLANET_LABEL_EN,
};

const PLANET_COLORS: Record<string, string> = {
  sun: "#d4a843", moon: "#b0adc8", mercury: "#60a5fa", venus: "#e879a8",
  mars: "#f87171", jupiter: "#34d399", saturn: "#a78bfa",
  uranus: "#67e8f9", neptune: "#818cf8", pluto: "#c4b5fd",
  // LILITH-V1
  lilith: "#9f7aea", northNode: "#fbbf24", southNode: "#a8a29e",
  // ASTEROIDS-V1
  chiron: "#b08968", ceres: "#86c98e", pallas: "#5eb6b3",
  juno: "#d28fc0", vesta: "#e0a857", lilithTrue: "#7c5fd0",
};

const ASPECT_GLYPHS: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□",
  trine: "△", opposition: "☍", quincunx: "⚻",
  // ASPECTS-MINEURS-V1
  semisextile: "⚺", semisquare: "∠", sesquiquadrate: "⚼", quintile: "Q",
};

const ASPECT_TYPE_FR: Record<string, string> = {
  conjunction: "Conjonction", sextile: "Sextile", square: "Carré",
  trine: "Trigone", opposition: "Opposition", quincunx: "Quinconce",
  // ASPECTS-MINEURS-V1
  semisextile: "Semi-sextile", semisquare: "Semi-carré",
  sesquiquadrate: "Sesqui-carré", quintile: "Quintile",
};

const ASPECT_TYPE_EN: Record<string, string> = {
  conjunction: "Conjunction", sextile: "Sextile", square: "Square",
  trine: "Trine", opposition: "Opposition", quincunx: "Quincunx",
  // ASPECTS-MINEURS-V1
  semisextile: "Semi-sextile", semisquare: "Semi-square",
  sesquiquadrate: "Sesquiquadrate", quintile: "Quintile",
};

const ASPECT_TYPES: Record<Lang, Record<string, string>> = {
  fr: ASPECT_TYPE_FR,
  en: ASPECT_TYPE_EN,
};

const ASPECT_TONE_COLOR: Record<string, string> = {
  h: "var(--harmony)",
  t: "var(--tension)",
  n: "var(--gold)",
};

// POINTS-ARABES-V1 : les 7 Lots hermétiques — nom + « ce qu'il éclaire »
// en clair (FR/EN), pour rester lisible par un néophyte. Glosses tirées
// des significations traditionnelles des lots.
const HERMETIC_LOTS: Array<{
  key: "fortune" | "spirit" | "eros" | "necessity" | "courage" | "victory" | "nemesis";
  fr:  [string, string];
  en:  [string, string];
}> = [
  { key: "fortune",   fr: ["Fortune",   "Corps, chance, circonstances"],        en: ["Fortune",   "Body, fortune, circumstances"] },
  { key: "spirit",    fr: ["Esprit",    "Volonté, action consciente"],          en: ["Spirit",    "Will, conscious action"] },
  { key: "eros",      fr: ["Éros",      "Désir, amour, ce que l'on recherche"], en: ["Eros",      "Desire, love, what one seeks"] },
  { key: "necessity", fr: ["Nécessité", "Contraintes, obligations subies"],     en: ["Necessity", "Constraints, imposed obligations"] },
  { key: "courage",   fr: ["Courage",   "Audace, initiative, conflits"],        en: ["Courage",   "Boldness, initiative, conflict"] },
  { key: "victory",   fr: ["Victoire",  "Succès, foi, accomplissement"],        en: ["Victory",   "Success, faith, achievement"] },
  { key: "nemesis",   fr: ["Némésis",   "Épreuves, limites"],                   en: ["Nemesis",   "Ordeals, limits"] },
];

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
    // ASTEROIDS-V1
    ceres: "Ceres", pallas: "Pallas", juno: "Juno", vesta: "Vesta",
    lilithtrue: "LilithTrue", lilithTrue: "LilithTrue",
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

function signFromIdx(idx: number | undefined, lang: Lang = "fr"): { name: string; glyph: string } {
  if (typeof idx !== "number" || idx < 0 || idx > 11) return { name: "—", glyph: "" };
  const names = lang === "en" ? SIGN_NAMES_EN_BY_IDX : SIGN_NAMES_BY_IDX;
  return { name: names[idx], glyph: SIGN_GLYPHS_BY_IDX[idx] };
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
  const { locale, t } = useApp();
  const lang: Lang = locale === "en" ? "en" : "fr";
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
  const ascSign = signFromIdx(ascSignIdx, lang);
  const ascDegInSign = typeof ascDeg === "number" ? ascDeg % 30 : undefined;

  // VERTEX-V1 : section « Angles » — Ascendant · Milieu du Ciel · Vertex.
  // Une ligne par angle réellement présent : le Vertex est absent en mode
  // astracore (extrait de Swiss Ephemeris uniquement).
  const mcDeg: number | undefined = typeof chart?.mc === "number" ? chart.mc : undefined;
  const vertexDeg: number | undefined = typeof chart?.vertex === "number" ? chart.vertex : undefined;
  const angleRows: React.ReactNode[][] = (
    [
      [t("datasheet_ascendant"), ascDeg],
      [t("datasheet_mc"),        mcDeg],
      [t("datasheet_vertex"),    vertexDeg],
    ] as Array<[string, number | undefined]>
  )
    .filter(([, deg]) => typeof deg === "number")
    .map(([label, deg]) => {
      const d = deg as number;
      const sg = signFromIdx(Math.floor(d / 30), lang);
      return [
        <strong key="a">{label}</strong>,
        <span key="s">{sg.glyph} {sg.name}</span>,
        <span key="d" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
          {formatDegree(d % 30)}
        </span>,
      ];
    });

  // ANTISCIA-V1 : antiscion = réflexion d'une longitude sur l'axe des
  // solstices (0° Cancer / 0° Capricorne) → (180 − λ). Contre-antiscion =
  // réflexion sur l'axe des équinoxes (0° Bélier / 0° Balance) → (360 − λ).
  // Dérivation géométrique pure depuis la longitude — aucun calcul
  // d'éphémérides, donc valable quel que soit le moteur.
  const mod360 = (x: number): number => ((x % 360) + 360) % 360;
  const fmtPoint = (deg: number): string => {
    const sg = signFromIdx(Math.floor(deg / 30), lang);
    return `${sg.glyph} ${sg.name} ${formatDegree(deg % 30)}`;
  };
  const antisciaRows: React.ReactNode[][] = planets
    .filter((p) => typeof p?.longitude === "number")
    .map((p) => [
      <span key="body">
        <span style={{ marginRight: 6, opacity: 0.85 }}>{PLANET_GLYPHS[p.planet] ?? "✦"}</span>
        {PLANET_LABELS[lang][p.planet] ?? p.planet}
      </span>,
      <span key="anti">{fmtPoint(mod360(180 - (p.longitude as number)))}</span>,
      <span key="contra">{fmtPoint(mod360(360 - (p.longitude as number)))}</span>,
    ]);

  // DIGNITES-V1 : dignités essentielles par planète (domicile, exaltation,
  // exil, chute) + score. Lookup pur — cf. lib/astro-dignities.
  const DIGNITY_LABEL: Record<DignityKind, string> = {
    domicile:   t("datasheet_dignity_domicile"),
    exaltation: t("datasheet_dignity_exaltation"),
    detriment:  t("datasheet_dignity_exil"),
    fall:       t("datasheet_dignity_chute"),
    peregrine:  t("datasheet_dignity_peregrine"),
  };
  const DIGNITY_COLOR: Record<DignityKind, string> = {
    domicile:   "var(--harmony)",
    exaltation: "var(--gold)",
    detriment:  "var(--tension)",
    fall:       "var(--tension)",
    peregrine:  "var(--muted)",
  };
  // Calcul pur (pas de mutation pendant le render) : on résout d'abord les
  // planètes dignifiées, puis on dérive total + lignes immutablement.
  const dignified: Array<{ p: any; dig: DignityResult }> = planets
    .map((p) => {
      if (typeof p?.longitude !== "number") return null;
      const dig = computeDignity(String(p.planet ?? ""), Math.floor(p.longitude / 30));
      return dig ? { p, dig } : null;   // null = nœuds, Chiron, Lilith, Fortune…
    })
    .filter((x): x is { p: any; dig: DignityResult } => x !== null);
  const dignityTotal = dignified.reduce((sum, { dig }) => sum + dig.score, 0);
  const dignityRows: React.ReactNode[][] = dignified.map(({ p, dig }) => {
    const color = DIGNITY_COLOR[dig.kind];
    return [
      <span key="body">
        <span style={{ marginRight: 6, opacity: 0.85 }}>{PLANET_GLYPHS[p.planet] ?? "✦"}</span>
        {PLANET_LABELS[lang][p.planet] ?? p.planet}
      </span>,
      <span key="dig" style={{ color }}>{DIGNITY_LABEL[dig.kind]}</span>,
      <span key="score" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color }}>
        {dig.score > 0 ? `+${dig.score}` : String(dig.score)}
      </span>,
    ];
  });

  // POINTS-ARABES-V1 : section « Points arabes » — les 7 Lots hermétiques.
  // chart.lots est fourni par le moteur (peut être absent selon le moteur actif).
  const lots = chart?.lots as Record<string, number> | undefined;
  const lotsRows: React.ReactNode[][] = (lots && typeof lots === "object")
    ? HERMETIC_LOTS.map((lot) => {
        const lon = lots[lot.key];
        const [name, theme] = lang === "en" ? lot.en : lot.fr;
        return [
          <strong key="n">{name}</strong>,
          <span key="m" style={{ color: "var(--muted)" }}>{theme}</span>,
          <span key="p">{typeof lon === "number" ? fmtPoint(lon) : "—"}</span>,
        ];
      })
    : [];

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

  // EXPORT-JSON-V1 — données pures sérialisables (parallèles aux *Rows JSX).
  // Antisces : géométrie pure depuis longitude → réutilisé dans le JSON
  // d'export sans avoir à reparcourir le React tree.
  const antisciaData = planets
    .filter((p) => typeof p?.longitude === "number")
    .map((p) => {
      const anti = mod360(180 - (p.longitude as number));
      const contra = mod360(360 - (p.longitude as number));
      return {
        planet: p.planet,
        antiscion: { longitude: anti, signIdx: Math.floor(anti / 30), signDegree: anti % 30 },
        contraAntiscion: { longitude: contra, signIdx: Math.floor(contra / 30), signDegree: contra % 30 },
      };
    });
  const dignityData = dignified.map(({ p, dig }) => ({
    planet: p.planet,
    kind: dig.kind,
    score: dig.score,
  }));

  function handleDownloadJSON() {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: "natal-export-v1",
      profile: {
        label: profile?.label ?? profile?.name ?? null,
        birthDate: profile?.birthDate ?? null,
        birthTime: profile?.birthTime ?? null,
        birthTimeUnknown: !!profile?.birthTimeUnknown,
        birthCity: profile?.birthCity ?? null,
        birthCountry: profile?.birthCountry ?? null,
      },
      chart: {
        houseSystem: chart?.houseSystem ?? null,
        zodiac: chart?.zodiac ?? null,
        JD: chart?.JD ?? null,
        asc: ascDeg ?? null,
        mc: mcDeg ?? null,
        vertex: vertexDeg ?? null,
        planets,
        houses,
        aspects,
        lots: chart?.lots ?? null,
        moonPhase: chart?.moonPhase ?? null,
        meta: chart?.meta ?? null,
      },
      derived: {
        bigThree: {
          sun:  sunP  ? { sign: sunP.sign,  signDegree: sunP.signDegree,  house: sunP.house  ?? null } : null,
          moon: moonP ? { sign: moonP.sign, signDegree: moonP.signDegree, house: moonP.house ?? null } : null,
          ascendant: typeof ascDeg === "number"
            ? { sign: signFromIdx(ascSignIdx, "en").name || null, signDegree: ascDegInSign ?? null, longitude: ascDeg }
            : null,
        },
        antiscia: antisciaData,
        dignities: { entries: dignityData, total: dignityTotal },
        topAspects,
      },
    };

    const slug = String(profile?.label ?? profile?.name ?? "theme-natal")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 64) || "theme-natal";

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-natal.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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
                {t("datasheet_eyebrow")}
              </div>
              <h1 style={{ fontSize: 28, color: "var(--gold)", margin: 0, lineHeight: 1.15 }}>
                {profile?.label ?? profile?.name ?? t("datasheet_chart_fallback")}
              </h1>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleDownloadJSON}
                className="btn-ghost"
                style={{ fontSize: 12 }}
              >
                📥 {t("datasheet_download_json")}
              </button>
              <button
                onClick={() => window.print()}
                className="btn-ghost"
                style={{ fontSize: 12 }}
              >
                🖨 {t("datasheet_print")}
              </button>
            </div>
          </div>
        </div>

        {/* ============ IDENTITÉ ============ */}
        <Section title={t("datasheet_section_identity")}>
          <Grid2>
            <Field label={t("datasheet_field_name")} value={profile?.label ?? profile?.name ?? "—"} />
            <Field label={t("datasheet_field_birthdate")} value={profile?.birthDate ?? "—"} />
            <Field
              label={t("datasheet_field_time")}
              value={
                profile?.birthTimeUnknown
                  ? t("datasheet_time_unknown")
                  : profile?.birthTime ?? "—"
              }
            />
            <Field
              label={t("datasheet_field_place")}
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
              label={PLANET_LABELS[lang]["Sun"]}
              glyph="☉"
              sign={sunP?.sign ? signFromIdxName(sunP.sign, lang) : { name: "—", glyph: "" }}
              degree={sunP?.signDegree}
              house={sunP?.house}
              housePrefix={lang === "en" ? "H" : "M"}
            />
            <BigThreeCard
              label={PLANET_LABELS[lang]["Moon"]}
              glyph="☽"
              sign={moonP?.sign ? signFromIdxName(moonP.sign, lang) : { name: "—", glyph: "" }}
              degree={moonP?.signDegree}
              house={moonP?.house}
              housePrefix={lang === "en" ? "H" : "M"}
            />
            <BigThreeCard
              label={t("datasheet_ascendant")}
              glyph="✦"
              sign={ascSign}
              degree={ascDegInSign}
              house={1}
              housePrefix={lang === "en" ? "H" : "M"}
            />
          </div>
        </Section>

        {/* ============ ROUE ZODIACALE ============ */}
        <Section title={t("datasheet_section_wheel")}>
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
              /* WHEEL-TRUE-MC-V1 : cuspides Placidus réelles + vrai MC —
                 la roue affichait des maisons égales asc+i·30 et un MC
                 fabriqué à asc+270, en contradiction avec la fiche. */
              houses={chart?.houses}
              mc={mcDeg}
              chartName={profile?.label ?? t("datasheet_chart_fallback")}
              showHouses={true}
              showAspects={true}
              showPlanets={true}
            />
          </div>
        </Section>

        {/* ============ POSITIONS PLANÉTAIRES ============ */}
        <Section title={t("datasheet_section_positions")}>
          <DataTable
            head={[t("datasheet_th_body"), t("datasheet_th_sign"), t("datasheet_th_degree"), t("datasheet_th_house"), t("datasheet_th_status")]}
            rows={planets.map((p) => {
              const sg = p.sign ? signFromIdxName(p.sign, lang) : { name: "—", glyph: "" };
              return [
                <span key="body"><span style={{ marginRight: 6, opacity: 0.85 }}>{PLANET_GLYPHS[p.planet] ?? "✦"}</span>{PLANET_LABELS[lang][p.planet] ?? p.planet}</span>,
                <span key="sign">{sg.glyph} {sg.name}</span>,
                <span key="degree" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{formatDegree(p.signDegree)}</span>,
                <span key="house">{typeof p.house === "number" ? p.house : "—"}</span>,
                p.retrograde ? <span key="status" style={{ color: "var(--tension)" }}>{t("datasheet_retrograde")}</span> : <span key="status" style={{ color: "var(--harmony)" }}>{t("datasheet_direct")}</span>,
              ];
            })}
          />
        </Section>

        {/* ============ MAISONS ============ */}
        <Section title={t("datasheet_section_houses")}>
          <DataTable
            head={[t("datasheet_th_house"), t("datasheet_th_cusp"), t("datasheet_th_degree")]}
            rows={houses.map((h) => {
              const sg = h.sign ? signFromIdxName(h.sign, lang) : { name: "—", glyph: "" };
              return [
                <strong key="house">{t("datasheet_house_word")} {h.house}</strong>,
                <span key="cusp">{sg.glyph} {sg.name}</span>,
                <span key="degree" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{formatDegree(h.signDegree)}</span>,
              ];
            })}
          />
        </Section>

        {/* ============ ANGLES (VERTEX-V1) ============ */}
        {angleRows.length > 0 && (
          <Section title={t("datasheet_section_angles")}>
            <DataTable
              head={[t("datasheet_th_angle"), t("datasheet_th_sign"), t("datasheet_th_degree")]}
              rows={angleRows}
            />
          </Section>
        )}

        {/* ============ ANTISCIA (ANTISCIA-V1) ============ */}
        {antisciaRows.length > 0 && (
          <Section title={t("datasheet_section_antiscia")}>
            <DataTable
              head={[t("datasheet_th_body"), t("datasheet_th_antiscion"), t("datasheet_th_contra_antiscion")]}
              rows={antisciaRows}
            />
          </Section>
        )}

        {/* ============ DIGNITÉS (DIGNITES-V1) ============ */}
        {dignityRows.length > 0 && (
          <Section title={t("datasheet_section_dignities")}>
            <DataTable
              head={[t("datasheet_th_body"), t("datasheet_th_dignity"), t("datasheet_th_score")]}
              rows={dignityRows}
            />
            <p style={{
              fontSize: 11,
              color: "var(--muted)",
              textAlign: "right",
              marginTop: 6,
              fontFamily: "var(--font-mono)",
            }}>
              {t("datasheet_dignity_total")} : {dignityTotal > 0 ? `+${dignityTotal}` : dignityTotal}
            </p>
          </Section>
        )}

        {/* ============ POINTS ARABES (POINTS-ARABES-V1) ============ */}
        {lotsRows.length > 0 && (
          <Section title={t("datasheet_section_lots")}>
            <p style={{
              fontSize: 11.5,
              color: "var(--muted)",
              marginBottom: 10,
              lineHeight: 1.5,
            }}>
              {t("datasheet_lots_intro")}
            </p>
            <DataTable
              head={[t("datasheet_th_lot"), t("datasheet_th_lot_meaning"), t("datasheet_th_position")]}
              rows={lotsRows}
            />
            <p style={{
              fontSize: 10.5,
              color: "var(--muted-2)",
              marginTop: 8,
              fontStyle: "italic",
            }}>
              ⌖ {t("datasheet_lots_source")}
            </p>
          </Section>
        )}

        {/* ============ ASPECTS ============ */}
        <Section title={`${t("datasheet_section_aspects")} (${topAspects.length} ${t("datasheet_aspects_by_orb")})`}>
          {topAspects.length > 0 ? (
            <DataTable
              // ASPECTS-STATE-COL-FIX : colonne « État » retirée. Elle lisait
              // a.applying, champ jamais calculé par le moteur natal → elle
              // affichait « Séparatif » pour 100 % des aspects. Applicatif/
              // séparatif demande les vitesses planétaires (feature à part).
              head={["P1", t("datasheet_th_aspect"), "P2", t("datasheet_th_type"), t("datasheet_th_orb")]}
              rows={topAspects.map((a) => {
                const tone = a.tone ?? "n";
                const glyph = ASPECT_GLYPHS[a.type] ?? "—";
                const typeLabel = ASPECT_TYPES[lang][a.type] ?? a.type;
                return [
                  <span key="p1"><span style={{ marginRight: 4, opacity: 0.85 }}>{PLANET_GLYPHS[a.planet1] ?? PLANET_GLYPHS[(a.planet1 ?? "").toLowerCase()] ?? ""}</span>{PLANET_LABELS[lang][capitalize(a.planet1)] ?? a.planet1}</span>,
                  <span key="aspect" style={{ color: ASPECT_TONE_COLOR[tone] ?? "var(--gold)", fontSize: 16 }}>{glyph}</span>,
                  <span key="p2"><span style={{ marginRight: 4, opacity: 0.85 }}>{PLANET_GLYPHS[a.planet2] ?? PLANET_GLYPHS[(a.planet2 ?? "").toLowerCase()] ?? ""}</span>{PLANET_LABELS[lang][capitalize(a.planet2)] ?? a.planet2}</span>,
                  <span key="type">{typeLabel}</span>,
                  <span key="orb" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{formatDegree(a.orb)}</span>,
                ];
              })}
            />
          ) : (
            <p style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 13 }}>
              {t("datasheet_no_aspects")}
            </p>
          )}
        </Section>

        {/* ============ PHASE LUNAIRE ============ */}
        {moonPhase && (
          <Section title={t("datasheet_section_moonphase")}>
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
                      ({Math.round(moonPhase.illumination * 100)}% {t("datasheet_illuminated")})
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
        <Section title={t("datasheet_section_metadata")}>
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
            <strong style={{ color: "var(--gold)" }}>Llmastro</strong> · {t("datasheet_footer_generated")} {new Date().toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <p style={{ marginBottom: 6 }}>
            {t("datasheet_footer_calc")}
          </p>
          <p style={{ fontSize: 9.5, opacity: 0.75 }}>
            {t("datasheet_footer_disclaimer")}
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
  label, glyph, sign, degree, house, housePrefix,
}: {
  label: string;
  glyph: string;
  sign: { name: string; glyph: string };
  degree: number | undefined;
  house: number | undefined;
  housePrefix: string;
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
        {formatDegree(degree)}{typeof house === "number" ? ` · ${housePrefix}${house}` : ""}
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

// signe (EN ou FR en entrée) → glyph + nom localisé
function signFromIdxName(signAny: string, lang: Lang = "fr"): { name: string; glyph: string } {
  let idx = SIGN_NAMES_BY_IDX.indexOf(signAny);
  if (idx < 0) idx = SIGN_NAMES_EN_BY_IDX.indexOf(signAny);
  return signFromIdx(idx >= 0 ? idx : undefined, lang);
}

// ARCHIVE-NATAL-DATASHEET-V1 applied

// ARCHIVE-NATAL-I18N-FR-V1 applied

// ARCHIVE-NATAL-I18N-FR-V2 applied

// VERTEX-V1 applied

// ANTISCIA-V1 applied

// ASPECTS-MINEURS-V1 applied

// DIGNITES-V1 applied

// POINTS-ARABES-V1 applied

// EXPORT-JSON-V1 applied
