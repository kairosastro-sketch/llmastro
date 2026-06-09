// ============================================================
// astrocartography-reading.service.ts — ASTROCARTOGRAPHY-V1
// ------------------------------------------------------------
// « Lecture de vos lieux » repensée (suite retour produit) :
//   1. ANCRÉE sur un lieu réel (défaut : ville de naissance) — auto-
//      compréhension : quelles lignes natales passent près de CE lieu.
//   2. HOOK TEMPOREL : ce que les transits du moment ACTIVENT sur les
//      lignes natales (réutilise les aspects transit→natal déjà calculés).
//   → fini le « tour du monde » passif de villes lointaines.
//
// Règle maison : on calcule les faits server-side ; le modèle ne fait
// qu'interpréter, il n'invente aucun lieu ni placement.
// ============================================================

import type { AstrocartographyResult } from "@astro-platform/ephemeris";
import { kairosToneDirective } from "./ai-prompts.service.js";
import type { XaiMessage } from "./ai.service.js";

// ── Grandes villes-repères pour NOMMER les régions d'une ligne ──
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
const READING_BODIES = ["sun", "moon", "venus", "mars", "jupiter", "saturn"];
const ANGLE_FR: Record<string, string> = {
  MC: "culmine", IC: "passe au plus bas", AC: "se lève", DC: "se couche",
};

const wrap = (l: number) => ((l + 540) % 360) - 180;

/** Distance angulaire approx (deg) d'un point à une courbe (lat/lng). */
function distToCurve(lat: number, lng: number, pts: { lat: number; lng: number }[]): number {
  let best = 1e9;
  for (const p of pts) {
    const d = Math.hypot(p.lat - lat, wrap(p.lng - lng) * Math.cos((lat * Math.PI) / 180));
    if (d < best) best = d;
  }
  return best;
}

/** Villes proches d'un méridien (MC/IC), pour nommer une région. */
function citiesNearMeridian(lng: number, thresh = 8, n = 2): string[] {
  return CITIES.map((c) => ({ name: c.name, d: Math.abs(wrap(c.lng - lng)) }))
    .filter((c) => c.d < thresh).sort((a, b) => a.d - b.d).slice(0, n).map((c) => c.name);
}

/** Lignes natales qui passent près d'un LIEU (lat/lng) : auto-compréhension. */
function bodiesNearPlace(
  acg: AstrocartographyResult, lat: number, lng: number, thresh = 5,
): { glyph: string; fr: string; angle: string }[] {
  const out: { glyph: string; fr: string; angle: string }[] = [];
  const byKey = new Map(acg.lines.map((l) => [l.key, l]));
  for (const key of READING_BODIES) {
    const l = byKey.get(key); const b = BODY[key];
    if (!l || !b) continue;
    const checks: [string, number][] = [
      ["MC", Math.abs(wrap(l.mcLng - lng))],
      ["IC", Math.abs(wrap(l.icLng - lng))],
      ["AC", distToCurve(lat, lng, l.asc)],
      ["DC", distToCurve(lat, lng, l.dsc)],
    ];
    // garde le meilleur angle de ce corps s'il est sous le seuil
    const best = checks.filter(([, d]) => d < thresh).sort((a, b) => a[1] - b[1])[0];
    if (best) out.push({ glyph: b.glyph, fr: b.fr, angle: best[0] });
  }
  return out;
}

export interface AcgAnchor { name: string; lat: number; lng: number; }
/** Une planète natale activée par un transit en ce moment. */
export interface AcgActivation {
  transitPlanet: string; natalPlanet: string; typeFr: string;
  tone: "harmony" | "tension" | "neutral";
}

export interface AcgFacts { factsText: string; hasContent: boolean; }

/**
 * Faits injectés au modèle : (1) lignes près du lieu ancré, (2) ce que les
 * transits activent en ce moment (planète natale → ses régions).
 */
export function deriveAstrocartographyFacts(
  acg: AstrocartographyResult,
  anchor: AcgAnchor,
  activations: AcgActivation[],
): AcgFacts {
  const byKey = new Map(acg.lines.map((l) => [l.key, l]));
  const parts: string[] = [];

  // 1. LIEU ANCRÉ
  const near = bodiesNearPlace(acg, anchor.lat, anchor.lng);
  parts.push(`LIEU DE RÉFÉRENCE : ${anchor.name} (là où la personne vit / est née).`);
  if (near.length) {
    parts.push(
      "Lignes natales qui passent près de ce lieu (ce que ce lieu fait vivre) :",
      ...near.map((n) => `- ${n.glyph} ${n.fr} y ${ANGLE_FR[n.angle]}.`),
    );
  } else {
    parts.push("Aucune ligne planétaire forte ne passe près de ce lieu — ses lieux de pouvoir sont AILLEURS (insight : la personne peut sentir que sa pleine puissance se vit en voyage / en relocalisation).");
  }

  // 2. ACTIVATIONS DU MOMENT (transits → natal)
  const seen = new Set<string>();
  const actLines: string[] = [];
  for (const a of activations) {
    if (seen.has(a.natalPlanet)) continue; seen.add(a.natalPlanet);
    const nb = BODY[a.natalPlanet], tb = BODY[a.transitPlanet];
    const l = byKey.get(a.natalPlanet);
    if (!nb || !tb || !l || !READING_BODIES.includes(a.natalPlanet)) continue;
    const regions = citiesNearMeridian(l.mcLng);
    const toneFr = a.tone === "harmony" ? "favorable" : a.tone === "tension" ? "exigeant / à travailler" : "à activer";
    actLines.push(
      `- ${tb.glyph} ${tb.fr} en transit ${a.typeFr} ${nb.glyph} ${nb.fr} natale ` +
      `→ tes lieux de ${nb.fr}${regions.length ? ` (vers ${regions.join(", ")})` : ""} sont ${toneFr} en ce moment.`,
    );
    if (actLines.length >= 4) break;
  }
  if (actLines.length) {
    parts.push("\nACTIVÉ EN CE MOMENT (les transits du jour réveillent certaines de tes lignes) :", ...actLines);
  }

  return { factsText: parts.join("\n"), hasContent: near.length > 0 || actLines.length > 0 };
}

export function buildAstrocartographyReadingMessages(
  factsText: string,
  natalLabel: string | undefined,
  anchorName: string,
  birthTimeKnown: boolean,
  locale: string = "fr",
): XaiMessage[] {
  const system = [
    kairosToneDirective(locale),
    "",
    "── TÂCHE : ASTROCARTOGRAPHIE, « TES LIEUX » ──",
    "On te fournit des FAITS calculés. Tu n'inventes AUCUN lieu ni placement :",
    "tu interprètes uniquement ce qui est fourni. L'astrocartographie parle de",
    "LIEUX (où la personne se sent aimée, reconnue, à l'épreuve, chez elle…).",
    "",
    "DISTINGUE EXPLICITEMENT DEUX TEMPORALITÉS (c'est essentiel, sinon on",
    "confond) :",
    "• PERMANENT : la carte est figée à la naissance et vaut TOUTE LA VIE — le",
    "  sens d'un lieu ne change jamais (« ce lieu restera toujours… »).",
    "• MOMENT : les activations transit→natal sont une FENÊTRE PASSAGÈRE (cette",
    "  période / ces semaines), pas un état permanent ni un horoscope du jour.",
    "",
    "Structure en 2 temps, en prose, ton chaleureux et concret :",
    `1. CE LIEU, POUR TOUJOURS (${anchorName}) : ce qu'il fait vivre DURABLEMENT`,
    "   à la personne d'après les lignes qui y passent — auto-compréhension de sa",
    "   vie (ex. « tu es né·e près de ta ligne de Saturne : ce sera toujours un",
    "   lieu de devoir pour toi »). Emploie un présent/futur de permanence (« reste »,",
    "   « pour toujours »). Si AUCUNE ligne forte n'y passe, dis-le franchement :",
    "   sa puissance se vit ailleurs (utile, pas un défaut).",
    "2. CE QUI S'ALLUME EN CE MOMENT : d'après les activations, vers quelle(s)",
    "   région(s) la PÉRIODE ACTUELLE est porteuse (ou exigeante) — en marquant",
    "   bien que c'est TEMPORAIRE (« ces semaines-ci », « en ce moment »), une",
    "   fenêtre à saisir, distincte du sens permanent du lieu. Si rien ne s'active,",
    "   ne force pas : dis simplement que rien de marquant ne s'éveille là maintenant.",
    "",
    "150-230 mots. Pas de liste à puces : de la prose. Pas de jargon non expliqué",
    "(dis « là où il culmine / se lève », pas « MC/AC » seul). Termine par une",
    "invitation brève (à ressentir, à explorer un lieu, sans promettre l'avenir).",
    birthTimeKnown ? "" : "ATTENTION : heure de naissance INCONNUE — dis une fois, brièvement, que les lieux sont indicatifs.",
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
