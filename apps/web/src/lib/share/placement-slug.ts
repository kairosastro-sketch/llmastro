// ============================================================
// COMMUNITY-SHARE-OG-V1 — slug de partage d'un placement communautaire.
// ------------------------------------------------------------
// Encode UNIQUEMENT des faits astrologiques anonymes dans le CHEMIN
// d'URL (planète big-three + signe + pourcentage). Aucune donnée de
// naissance, aucun identifiant. Le chemin (pas la query) car une
// `opengraph-image` Next.js ne reçoit que les params de route.
//
//   slug = "moon-scorpio-8"  →  { planet:"moon", sign:"scorpio", pct:8 }
// ============================================================

export type SharePlanet = "sun" | "moon" | "ascendant";

export const SHARE_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;
export type ShareSign = (typeof SHARE_SIGNS)[number];

const SIGN_GLYPH: Record<ShareSign, string> = {
  aries: "♈", taurus: "♉", gemini: "♊", cancer: "♋", leo: "♌", virgo: "♍",
  libra: "♎", scorpio: "♏", sagittarius: "♐", capricorn: "♑", aquarius: "♒", pisces: "♓",
};
const SIGN_FR: Record<ShareSign, string> = {
  aries: "Bélier", taurus: "Taureau", gemini: "Gémeaux", cancer: "Cancer", leo: "Lion", virgo: "Vierge",
  libra: "Balance", scorpio: "Scorpion", sagittarius: "Sagittaire", capricorn: "Capricorne", aquarius: "Verseau", pisces: "Poissons",
};
const SIGN_EN: Record<ShareSign, string> = {
  aries: "Aries", taurus: "Taurus", gemini: "Gemini", cancer: "Cancer", leo: "Leo", virgo: "Virgo",
  libra: "Libra", scorpio: "Scorpio", sagittarius: "Sagittarius", capricorn: "Capricorn", aquarius: "Aquarius", pisces: "Pisces",
};

// Planète : glyphe + libellé + possessif français accordé en genre
// (la Lune est féminine → « ta Lune » ; Soleil / Ascendant → « ton »).
const PLANET_INFO: Record<SharePlanet, { glyph: string; fr: string; en: string; possFr: string }> = {
  sun:       { glyph: "☉", fr: "Soleil",    en: "Sun",       possFr: "ton" },
  moon:      { glyph: "☽", fr: "Lune",      en: "Moon",      possFr: "ta"  },
  ascendant: { glyph: "Asc", fr: "Ascendant", en: "Ascendant", possFr: "ton" },
};

export interface ParsedPlacement {
  planet: SharePlanet;
  sign: ShareSign;
  pct: number; // 0–100
  glyph: string;
  signGlyph: string;
  planetLabel(lang: "fr" | "en"): string;
  signLabel(lang: "fr" | "en"): string;
  possFr: string;
}

function isSharePlanet(s: string): s is SharePlanet {
  return s === "sun" || s === "moon" || s === "ascendant";
}
function isShareSign(s: string): s is ShareSign {
  return (SHARE_SIGNS as readonly string[]).includes(s);
}

/** Construit le slug à partir des valeurs renvoyées par l'API communauté
 *  (planète "Sun"/"Moon"/"Ascendant", signe "Aries" … "Pisces"). */
export function buildPlacementSlug(planet: string, sign: string, pct: number): string {
  const p = planet.toLowerCase();
  const s = sign.toLowerCase();
  const n = Math.max(0, Math.min(100, Math.round(pct)));
  return `${p}-${s}-${n}`;
}

/** Parse un slug en placement validé, ou null si invalide. */
export function parsePlacementSlug(slug: string): ParsedPlacement | null {
  const parts = slug.toLowerCase().split("-");
  if (parts.length !== 3) return null;
  const [planet, sign, pctRaw] = parts;
  if (!planet || !sign || !pctRaw) return null;
  if (!isSharePlanet(planet) || !isShareSign(sign)) return null;
  const pct = Number.parseInt(pctRaw, 10);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;

  const info = PLANET_INFO[planet];
  return {
    planet,
    sign,
    pct,
    glyph: info.glyph,
    signGlyph: SIGN_GLYPH[sign],
    planetLabel: (lang) => (lang === "en" ? info.en : info.fr),
    signLabel: (lang) => (lang === "en" ? SIGN_EN[sign] : SIGN_FR[sign]),
    possFr: info.possFr,
  };
}
