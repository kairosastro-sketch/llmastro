// ============================================================
// astrocartography-reading.service.ts — ASTROCARTOGRAPHY-V1
// ------------------------------------------------------------
// Dérive des FAITS lisibles de la carte natale (quelles lignes passent
// près de quelles grandes villes, quels croisements/parans forts) puis
// construit le prompt de la « lecture de vos lieux ».
//
// Conforme à la règle maison : on calcule les faits server-side et on les
// injecte dans le prompt — on ne laisse JAMAIS le modèle deviner une
// position. Le modèle ne fait qu'INTERPRÉTER les lieux fournis.
// ============================================================

import type { AstrocartographyResult } from "@astro-platform/ephemeris";
import { kairosToneDirective } from "./ai-prompts.service.js";
import type { XaiMessage } from "./ai.service.js";

// ── Grandes villes-repères (réparties sur le globe) ─────────
const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Londres", lat: 51.5, lng: -0.1 }, { name: "Paris", lat: 48.9, lng: 2.3 },
  { name: "Madrid", lat: 40.4, lng: -3.7 }, { name: "Rome", lat: 41.9, lng: 12.5 },
  { name: "Berlin", lat: 52.5, lng: 13.4 }, { name: "Lisbonne", lat: 38.7, lng: -9.1 },
  { name: "Athènes", lat: 38.0, lng: 23.7 }, { name: "Istanbul", lat: 41.0, lng: 29.0 },
  { name: "Moscou", lat: 55.7, lng: 37.6 }, { name: "Le Caire", lat: 30.0, lng: 31.2 },
  { name: "Casablanca", lat: 33.6, lng: -7.6 }, { name: "Lagos", lat: 6.5, lng: 3.4 },
  { name: "Accra", lat: 5.6, lng: -0.2 }, { name: "Nairobi", lat: -1.3, lng: 36.8 },
  { name: "Johannesburg", lat: -26.2, lng: 28.0 }, { name: "Le Cap", lat: -33.9, lng: 18.4 },
  { name: "Dubaï", lat: 25.2, lng: 55.3 }, { name: "Mumbai", lat: 19.1, lng: 72.9 },
  { name: "Delhi", lat: 28.6, lng: 77.2 }, { name: "Bangkok", lat: 13.8, lng: 100.5 },
  { name: "Singapour", lat: 1.4, lng: 103.8 }, { name: "Hong Kong", lat: 22.3, lng: 114.2 },
  { name: "Pékin", lat: 39.9, lng: 116.4 }, { name: "Shanghai", lat: 31.2, lng: 121.5 },
  { name: "Tokyo", lat: 35.7, lng: 139.7 }, { name: "Séoul", lat: 37.6, lng: 127.0 },
  { name: "Sydney", lat: -33.9, lng: 151.2 }, { name: "Auckland", lat: -36.8, lng: 174.8 },
  { name: "New York", lat: 40.7, lng: -74.0 }, { name: "Los Angeles", lat: 34.0, lng: -118.2 },
  { name: "Chicago", lat: 41.9, lng: -87.6 }, { name: "Mexico", lat: 19.4, lng: -99.1 },
  { name: "Bogota", lat: 4.7, lng: -74.1 }, { name: "Lima", lat: -12.0, lng: -77.0 },
  { name: "Rio de Janeiro", lat: -22.9, lng: -43.2 }, { name: "São Paulo", lat: -23.5, lng: -46.6 },
  { name: "Buenos Aires", lat: -34.6, lng: -58.4 },
];

const BODY: Record<string, { fr: string; glyph: string }> = {
  sun: { fr: "Soleil", glyph: "☉" }, moon: { fr: "Lune", glyph: "☽" },
  venus: { fr: "Vénus", glyph: "♀" }, mars: { fr: "Mars", glyph: "♂" },
  jupiter: { fr: "Jupiter", glyph: "♃" }, saturn: { fr: "Saturne", glyph: "♄" },
  mercury: { fr: "Mercure", glyph: "☿" }, uranus: { fr: "Uranus", glyph: "♅" },
  neptune: { fr: "Neptune", glyph: "♆" }, pluto: { fr: "Pluton", glyph: "♇" },
};
// Corps mis en avant dans la lecture (les plus parlants en relocation).
const READING_BODIES = ["sun", "moon", "venus", "mars", "jupiter", "saturn"];

const PAIR: Record<string, string> = {
  "jupiter+venus": "amour et abondance", "sun+venus": "reconnaissance par le cœur",
  "jupiter+sun": "réussite rayonnante", "moon+venus": "tendresse et foyer",
  "moon+sun": "unité intérieure", "jupiter+moon": "générosité et sécurité",
  "mars+venus": "désir et passion", "mars+sun": "force d'action",
  "saturn+sun": "autorité et devoir", "mars+saturn": "épreuve qui forge",
  "saturn+venus": "amour qui dure", "jupiter+saturn": "ambition structurée",
  "jupiter+mars": "conquête et audace", "mars+moon": "émotions vives",
  "moon+saturn": "gravité et racines", "mercury+venus": "charme et expression",
};
const pairMeaning = (a: string, b: string) => PAIR[[a, b].sort().join("+")] ?? "rencontre de deux forces";

const wrap = (l: number) => ((l + 540) % 360) - 180;

/** Villes proches d'une ligne (méridien MC/IC ou courbe AC/DC), max `n`. */
function citiesNearMeridian(lng: number, thresh = 7, n = 2): string[] {
  return CITIES
    .map((c) => ({ name: c.name, d: Math.abs(wrap(c.lng - lng)) }))
    .filter((c) => c.d < thresh).sort((a, b) => a.d - b.d).slice(0, n).map((c) => c.name);
}
function citiesNearCurve(pts: { lat: number; lng: number }[], thresh = 6, n = 2): string[] {
  return CITIES
    .map((c) => {
      let best = 1e9;
      for (const p of pts) {
        const dLng = wrap(p.lng - c.lng) * Math.cos((c.lat * Math.PI) / 180);
        const d = Math.hypot(p.lat - c.lat, dLng);
        if (d < best) best = d;
      }
      return { name: c.name, d: best };
    })
    .filter((c) => c.d < thresh).sort((a, b) => a.d - b.d).slice(0, n).map((c) => c.name);
}

export interface AcgFacts {
  factsText: string;
  /** Vrai si au moins une ligne/croisement a touché une ville (sinon lecture pauvre). */
  hasContent: boolean;
}

/**
 * Construit le bloc de faits injecté au modèle : pour chaque corps marquant,
 * où ses lignes sont angulaires ; et les croisements (parans) les plus forts.
 */
export function deriveAstrocartographyFacts(acg: AstrocartographyResult): AcgFacts {
  const lineByKey = new Map(acg.lines.map((l) => [l.key, l]));
  const parts: string[] = [];
  let hits = 0;

  parts.push("LIGNES NATALES (où vos planètes sont angulaires sur Terre) :");
  for (const key of READING_BODIES) {
    const l = lineByKey.get(key); const b = BODY[key];
    if (!l || !b) continue;
    const mc = citiesNearMeridian(l.mcLng);
    const ac = citiesNearCurve(l.asc);
    const dc = citiesNearCurve(l.dsc);
    const segs: string[] = [];
    if (mc.length) segs.push(`culmine (MC) au-dessus de ${mc.join(", ")}`);
    if (ac.length) segs.push(`se lève (AC) vers ${ac.join(", ")}`);
    if (dc.length) segs.push(`se couche (DC) vers ${dc.join(", ")}`);
    if (segs.length) { hits++; parts.push(`- ${b.glyph} ${b.fr} : ${segs.join(" ; ")}.`); }
  }

  // Croisements (parans) — dédoublonnés par couple, les plus forts d'abord.
  const seen = new Set<string>();
  const paranLines: string[] = [];
  for (const p of acg.parans) {
    const a = BODY[p.aKey], bb = BODY[p.bKey];
    if (!a || !bb) continue;
    const k = [p.aKey, p.bKey].sort().join("+");
    if (seen.has(k)) continue; seen.add(k);
    const city = citiesNearMeridian(p.lng, 9, 1)[0] ?? citiesNearCurve([{ lat: p.lat, lng: p.lng }], 9, 1)[0];
    if (!city) continue;
    paranLines.push(`- ${a.glyph}${bb.glyph} ${a.fr} × ${bb.fr} (${pairMeaning(p.aKey, p.bKey)}) — près de ${city}.`);
    if (paranLines.length >= 5) break;
  }
  if (paranLines.length) {
    hits++;
    parts.push("\nCROISEMENTS REMARQUABLES (deux astres angulaires ensemble) :");
    parts.push(...paranLines);
  }

  return { factsText: parts.join("\n"), hasContent: hits > 0 };
}

/**
 * Messages pour la « lecture de vos lieux » (texte, ton Kairos).
 */
export function buildAstrocartographyReadingMessages(
  factsText: string,
  natalLabel: string | undefined,
  birthTimeKnown: boolean,
  locale: string = "fr",
): XaiMessage[] {
  const system = [
    kairosToneDirective(locale),
    "",
    "── TÂCHE : LECTURE D'ASTROCARTOGRAPHIE (« VOS LIEUX ») ──",
    "On te fournit des FAITS calculés : quelles lignes planétaires natales",
    "passent près de quelles grandes villes, et les croisements (parans).",
    "Tu n'inventes AUCUN lieu ni placement : tu interprètes UNIQUEMENT ce qui",
    "est fourni. L'astrocartographie parle de LIEUX (où la personne se sentirait",
    "aimée, reconnue, en sécurité, mise à l'épreuve…) — pas du temps qui passe.",
    "",
    "Écris une lecture chaleureuse et concrète :",
    "- une courte intro (1-2 phrases) sur l'idée de ses lieux de pouvoir ;",
    "- puis 3 à 4 lieux MARQUANTS choisis parmi les faits, chacun en 2-3 phrases :",
    "  nomme l'astre, l'angle (culmine / se lève / croisement), la/les ville(s),",
    "  et ce que la personne pourrait y vivre. Privilégie Vénus, Jupiter, Soleil,",
    "  Lune ; mentionne Saturne/Mars comme lieux d'effort si pertinent.",
    "- termine par une phrase d'invitation (voyage, relocalisation, à ressentir).",
    "180 à 260 mots. Pas de listes à puces, de la prose. Pas de jargon technique",
    "non expliqué (MC/AC peut être dit « là où il culmine / se lève »).",
    birthTimeKnown
      ? ""
      : "ATTENTION : heure de naissance INCONNUE — précise une fois, brièvement, que les lieux sont indicatifs.",
  ].filter(Boolean).join("\n");

  const user = [
    natalLabel ? `Thème : ${natalLabel}.` : "",
    "Faits calculés :",
    factsText,
  ].filter(Boolean).join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
