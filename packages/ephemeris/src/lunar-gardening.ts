// ============================================================
// lunar-gardening.ts — LUNAR-GARDENING-V1
// ------------------------------------------------------------
// « Conseil jardinier du jour » déterministe, dérivé du
// calendrier lunaire (biodynamie). Aucune sortie LLM : tout est
// calculé côté serveur depuis la position réelle de la Lune.
//
// Trois leviers, tous calculés depuis les éphémérides :
//   1. Type de jour selon l'élément du signe lunaire
//        Terre → racines · Eau → feuilles · Air → fleurs · Feu → fruits
//   2. Lune montante / descendante (sève) selon la TENDANCE de la
//      déclinaison lunaire (et non la phase) : montante = déclinaison
//      croissante (on sème, on récolte les parties aériennes) ;
//      descendante = déclinaison décroissante (on plante, on taille,
//      on travaille la terre).
//   3. Jour de nœud : la Lune traverse l'écliptique (latitude ≈ 0).
//      La tradition conseille alors de laisser le jardin au repos.
//
// La phase croissante / décroissante est exposée à titre indicatif
// (détail), elle ne pilote pas le conseil principal pour éviter les
// contradictions avec la sève montante / descendante.
// ============================================================

import { R } from "./engine-core.js";
import { moonGeo, moonLat } from "./solar-lunar.js";
import { obliquityDeg } from "./astro-engine.js";

export type GardeningDayType = "root" | "leaf" | "flower" | "fruit";

export interface LunarGardeningTip {
  /** Type de jour biodynamique dérivé de l'élément du signe lunaire. */
  dayType: GardeningDayType;
  /** Libellé localisé du type de jour (ex. « Jour racines »). */
  dayTypeLabel: string;
  /** Emoji illustratif du type de jour. */
  emoji: string;
  /** Sève montante (true) ou descendante (false) — tendance de déclinaison. */
  ascending: boolean;
  /** Lune croissante (true) ou décroissante (false) — phase, indicatif. */
  waxing: boolean;
  /** Jour de nœud lunaire → jardin au repos (prioritaire sur le reste). */
  rest: boolean;
  /** Titre court de la carte. */
  title: string;
  /** Conseil d'action concret du jour. */
  advice: string;
  /** Ligne de contexte (sève + phase) sous le conseil. */
  detail: string;
}

type Lang = "fr" | "en";

// ── Élément du signe → type de jour ───────────────────────────
// signIdx : 0 Bélier … 11 Poissons.
const SIGN_DAY_TYPE: GardeningDayType[] = [
  "fruit",  // 0  Bélier      (Feu)
  "root",   // 1  Taureau     (Terre)
  "flower", // 2  Gémeaux     (Air)
  "leaf",   // 3  Cancer      (Eau)
  "fruit",  // 4  Lion        (Feu)
  "root",   // 5  Vierge      (Terre)
  "flower", // 6  Balance     (Air)
  "leaf",   // 7  Scorpion    (Eau)
  "fruit",  // 8  Sagittaire  (Feu)
  "root",   // 9  Capricorne  (Terre)
  "flower", // 10 Verseau     (Air)
  "leaf",   // 11 Poissons    (Eau)
];

const EMOJI: Record<GardeningDayType, string> = {
  root: "🥕",
  leaf: "🥬",
  flower: "🌸",
  fruit: "🍓",
};

// Phases croissantes (de la Nouvelle Lune au Premier croissant gibbeux).
const WAXING_KEYS = new Set(["moon_new", "moon_waxc", "moon_firstq", "moon_waxg"]);

// ── Textes localisés ──────────────────────────────────────────
const LABELS: Record<Lang, Record<GardeningDayType, string>> = {
  fr: { root: "Jour racines", leaf: "Jour feuilles", flower: "Jour fleurs", fruit: "Jour fruits" },
  en: { root: "Root day", leaf: "Leaf day", flower: "Flower day", fruit: "Fruit day" },
};

// advice[lang][dayType][ascending ? "up" : "down"]
const ADVICE: Record<Lang, Record<GardeningDayType, { up: string; down: string }>> = {
  fr: {
    root: {
      up:   "La sève monte : récoltez carottes, betteraves et pommes de terre, ils se conserveront mieux.",
      down: "La sève descend : journée idéale pour semer, repiquer et planter vos légumes-racines (carottes, radis, navets).",
    },
    leaf: {
      up:   "La sève monte : cueillez salades, épinards et fines herbes, et semez ce qui se récolte en feuilles.",
      down: "La sève descend : plantez et repiquez salades, choux et poireaux, puis arrosez généreusement.",
    },
    flower: {
      up:   "La sève monte : récoltez et bouturez les fleurs, semez les variétés florales et les plantes mellifères.",
      down: "La sève descend : plantez vivaces et bulbes, taillez les rosiers, soignez artichauts et brocolis.",
    },
    fruit: {
      up:   "La sève monte : récoltez tomates et fruits, et semez tomates, courges, haricots et pois.",
      down: "La sève descend : plantez arbres et arbustes fruitiers, taillez la vigne, rentrez les fruits à conserver.",
    },
  },
  en: {
    root: {
      up:   "Sap is rising: harvest carrots, beetroot and potatoes — they will keep better.",
      down: "Sap is falling: an ideal day to sow, transplant and plant your root vegetables (carrots, radishes, turnips).",
    },
    leaf: {
      up:   "Sap is rising: pick salads, spinach and herbs, and sow leafy crops.",
      down: "Sap is falling: plant and transplant salads, cabbages and leeks, then water generously.",
    },
    flower: {
      up:   "Sap is rising: harvest and take cuttings of flowers, sow flowering and pollinator-friendly varieties.",
      down: "Sap is falling: plant perennials and bulbs, prune the roses, tend artichokes and broccoli.",
    },
    fruit: {
      up:   "Sap is rising: harvest tomatoes and fruit, and sow tomatoes, squash, beans and peas.",
      down: "Sap is falling: plant fruit trees and bushes, prune the vine, bring in fruit for storage.",
    },
  },
};

const REST: Record<Lang, string> = {
  fr: "Jour de nœud lunaire : la tradition conseille de laisser le jardin au repos — évitez aujourd'hui semis et plantations.",
  en: "Lunar node day: tradition advises letting the garden rest — avoid sowing and planting today.",
};

const TITLE: Record<Lang, string> = { fr: "Au jardin aujourd'hui", en: "In the garden today" };

const SAP: Record<Lang, { up: string; down: string }> = {
  fr: { up: "Lune montante", down: "Lune descendante" },
  en: { up: "Ascending Moon", down: "Descending Moon" },
};

const PHASE: Record<Lang, { wax: string; wan: string }> = {
  fr: { wax: "croissante", wan: "décroissante" },
  en: { wax: "waxing", wan: "waning" },
};

// ── Astronomie : déclinaison lunaire & tendance de sève ───────

/** Déclinaison géocentrique de la Lune (degrés) pour un JD donné. */
function moonDeclination(JD: number): number {
  const T = (JD - 2451545) / 36525;
  const lon = moonGeo(T);          // longitude écliptique (deg)
  const lat = moonLat(T);          // latitude écliptique (deg)
  const eps = obliquityDeg(JD);    // obliquité (deg)
  const sinDec =
    Math.sin(lat * R) * Math.cos(eps * R) +
    Math.cos(lat * R) * Math.sin(eps * R) * Math.sin(lon * R);
  return Math.asin(Math.max(-1, Math.min(1, sinDec))) / R;
}

/**
 * Calcule le conseil jardinier du jour.
 *
 * @param moonSignIdx  Index du signe lunaire (0 Bélier … 11 Poissons).
 * @param moonPhaseKey Clé de phase (`moonPhase().key`) pour croissante/décroissante.
 * @param JD           Jour julien du moment (ex. `currentSky.JD`).
 * @param locale       "fr" (défaut) ou "en".
 */
export function lunarGardening(args: {
  moonSignIdx: number;
  moonPhaseKey: string;
  JD: number;
  locale?: string;
}): LunarGardeningTip {
  const lang: Lang = args.locale === "en" ? "en" : "fr";
  const idx = ((args.moonSignIdx % 12) + 12) % 12;
  const dayType = SIGN_DAY_TYPE[idx]!;

  // Sève : tendance de la déclinaison sur ±0,3 jour autour du moment.
  const ascending = moonDeclination(args.JD + 0.3) > moonDeclination(args.JD - 0.3);

  // Phase (indicatif).
  const waxing = WAXING_KEYS.has(args.moonPhaseKey);

  // Jour de nœud : la Lune traverse l'écliptique (latitude ≈ 0).
  const lat = moonLat((args.JD - 2451545) / 36525);
  const rest = Math.abs(lat) < 0.5;

  const sap = ascending ? SAP[lang].up : SAP[lang].down;
  const phase = waxing ? PHASE[lang].wax : PHASE[lang].wan;
  const advice = rest
    ? REST[lang]
    : ADVICE[lang][dayType][ascending ? "up" : "down"];

  return {
    dayType,
    dayTypeLabel: LABELS[lang][dayType],
    emoji: EMOJI[dayType],
    ascending,
    waxing,
    rest,
    title: TITLE[lang],
    advice,
    detail: `${sap} · ${lang === "fr" ? "Lune " : "Moon "}${phase}`,
  };
}

// LUNAR-GARDENING-V1 applied
