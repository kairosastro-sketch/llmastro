// ============================================================
// lunar-gardening.ts — LUNAR-GARDENING-V1
// ------------------------------------------------------------
// « Conseil jardinier du jour » déterministe, dérivé du
// calendrier lunaire (biodynamie). Aucune sortie LLM : tout est
// calculé côté serveur depuis la position réelle de la Lune.
//
// Quatre leviers, tous calculés depuis les éphémérides :
//   1. Type de jour selon l'élément du signe lunaire
//        Terre → racines · Eau → feuilles · Air → fleurs · Feu → fruits
//   2. Lune montante / descendante (sève) selon la TENDANCE de la
//      déclinaison lunaire (et non la phase) : montante = on récolte les
//      parties aériennes ; descendante = on plante, on taille, on travaille
//      la terre.
//   3. SAISON (dérivée du mois via le JD, + hémisphère via la latitude) :
//      les cultures proposées sont de saison — pas de « semer des tomates »
//      ni de « récolter des courges » en plein hiver.
//   4. Jour de nœud : la Lune traverse l'écliptique (latitude ≈ 0).
//      La tradition conseille alors de laisser le jardin au repos.
//
// ⚠️ Sève montante/descendante (déclinaison, ~13,6 j) ≠ Lune croissante/
// décroissante (illumination, ~29,5 j) : deux cycles indépendants. On peut
// être en Pleine Lune ET en sève montante le même jour. Seule la sève pilote
// le conseil ; la phase (`waxing`) reste dans la donnée mais n'apparaît pas
// dans le texte de la carte (déjà affichée par la carte « Phase lunaire »).
// ============================================================

import { R } from "./engine-core.js";
import { moonGeo, moonLat } from "./solar-lunar.js";
import { obliquityDeg } from "./astro-engine.js";

export type GardeningDayType = "root" | "leaf" | "flower" | "fruit";
export type GardeningSeason = "spring" | "summer" | "autumn" | "winter";

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
  /** Saison retenue pour choisir des cultures de saison. */
  season: GardeningSeason;
  /** Jour de nœud lunaire → jardin au repos (prioritaire sur le reste). */
  rest: boolean;
  /** Titre court de la carte. */
  title: string;
  /** Conseil d'action concret et de saison du jour. */
  advice: string;
  /** Ligne de contexte (sève) sous le conseil. */
  detail: string;
}

type Lang = "fr" | "en";
type Hemisphere = "north" | "south";

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

// Conseil de saison : advice[lang][season][dayType][montante ? "up" : "down"].
// Cultures réalistes pour un potager tempéré (hémisphère ajusté en amont).
// Montante (up) = récolte / parties aériennes ; descendante (down) = semis,
// plantation, travail du sol, taille.
type SeasonAdvice = Record<GardeningSeason, Record<GardeningDayType, { up: string; down: string }>>;

const ADVICE: Record<Lang, SeasonAdvice> = {
  fr: {
    spring: {
      root:   { up: "La sève monte : récoltez radis, navets primeurs et premières carottes.",
                down: "La sève descend : semez et plantez carottes, radis, betteraves et pommes de terre ; ameublissez la terre." },
      leaf:   { up: "La sève monte : cueillez épinards, mâche et premières salades.",
                down: "La sève descend : semez et repiquez salades, épinards, blettes, choux et poireaux." },
      flower: { up: "La sève monte : bouturez et récoltez les fleurs ; semez les annuelles.",
                down: "La sève descend : plantez vivaces, artichauts et bulbes d'été ; semez les fleurs." },
      fruit:  { up: "La sève monte : semez sous abri tomates, courges et concombres ; récoltez la rhubarbe.",
                down: "La sève descend : plantez fraisiers et arbustes à petits fruits ; repiquez les semis." },
    },
    summer: {
      root:   { up: "La sève monte : récoltez pommes de terre nouvelles, carottes et betteraves.",
                down: "La sève descend : semez carottes d'hiver, navets et radis d'hiver." },
      leaf:   { up: "La sève monte : cueillez salades, blettes et fines herbes.",
                down: "La sève descend : semez salades d'automne, mâche et choux ; repiquez les poireaux." },
      flower: { up: "La sève monte : récoltez et bouturez les fleurs ; cueillez les brocolis.",
                down: "La sève descend : plantez les bulbes d'automne ; soignez artichauts et fleurs." },
      fruit:  { up: "La sève monte : récoltez tomates, courgettes, haricots et fraises ; semez des haricots.",
                down: "La sève descend : plantez les fraisiers ; taillez en vert tomates et vigne." },
    },
    autumn: {
      root:   { up: "La sève monte : arrachez et rentrez carottes, betteraves, pommes de terre et panais pour la conservation.",
                down: "La sève descend : plantez ail, oignons et échalotes ; bêchez la terre." },
      leaf:   { up: "La sève monte : récoltez choux, poireaux, mâche et épinards.",
                down: "La sève descend : plantez les choux d'hiver, repiquez la mâche ; semez sous abri." },
      flower: { up: "La sève monte : cueillez les derniers brocolis, choux-fleurs et fleurs.",
                down: "La sève descend : plantez les bulbes de printemps (tulipes, narcisses) et les vivaces." },
      fruit:  { up: "La sève monte : récoltez courges, pommes, poires et dernières tomates.",
                down: "La sève descend : plantez arbres et arbustes fruitiers ; installez les fraisiers." },
    },
    winter: {
      root:   { up: "La sève monte : récoltez les légumes de garde encore en terre — panais, topinambours, carottes.",
                down: "La sève descend : laissez le sol au repos ; forcez les endives, plantez l'ail sous climat doux." },
      leaf:   { up: "La sève monte : récoltez poireaux, mâche, épinards et choux d'hiver.",
                down: "La sève descend : semez sous abri les premières salades ; paillez les planches." },
      flower: { up: "La sève monte : peu à cueillir — entretenez et planifiez le jardin d'agrément.",
                down: "La sève descend : plantez à racines nues les arbustes à fleurs ; taillez sous climat doux." },
      fruit:  { up: "La sève monte : peu de récolte — surveillez vos fruits en réserve.",
                down: "La sève descend : plantez les arbres fruitiers à racines nues ; taillez fruitiers et vigne." },
    },
  },
  en: {
    spring: {
      root:   { up: "Sap is rising: harvest radishes, baby turnips and the first carrots.",
                down: "Sap is falling: sow and plant carrots, radishes, beetroot and potatoes; work the soil." },
      leaf:   { up: "Sap is rising: pick spinach, lamb's lettuce and the first salads.",
                down: "Sap is falling: sow and transplant salads, spinach, chard, cabbages and leeks." },
      flower: { up: "Sap is rising: take cuttings and pick flowers; sow annuals.",
                down: "Sap is falling: plant perennials, artichokes and summer bulbs; sow flowers." },
      fruit:  { up: "Sap is rising: sow tomatoes, squash and cucumbers under cover; harvest rhubarb.",
                down: "Sap is falling: plant strawberries and soft-fruit bushes; transplant seedlings." },
    },
    summer: {
      root:   { up: "Sap is rising: harvest new potatoes, carrots and beetroot.",
                down: "Sap is falling: sow winter carrots, turnips and winter radishes." },
      leaf:   { up: "Sap is rising: pick salads, chard and herbs.",
                down: "Sap is falling: sow autumn salads, lamb's lettuce and cabbages; transplant leeks." },
      flower: { up: "Sap is rising: harvest and take cuttings of flowers; pick broccoli.",
                down: "Sap is falling: plant autumn bulbs; tend artichokes and flowers." },
      fruit:  { up: "Sap is rising: harvest tomatoes, courgettes, beans and strawberries; sow beans.",
                down: "Sap is falling: plant strawberry runners; summer-prune tomatoes and the vine." },
    },
    autumn: {
      root:   { up: "Sap is rising: lift and store carrots, beetroot, potatoes and parsnips.",
                down: "Sap is falling: plant garlic, onions and shallots; dig over the soil." },
      leaf:   { up: "Sap is rising: harvest cabbages, leeks, lamb's lettuce and spinach.",
                down: "Sap is falling: plant winter cabbages, transplant lamb's lettuce; sow under cover." },
      flower: { up: "Sap is rising: pick the last broccoli, cauliflowers and flowers.",
                down: "Sap is falling: plant spring bulbs (tulips, daffodils) and perennials." },
      fruit:  { up: "Sap is rising: harvest squash, apples, pears and the last tomatoes.",
                down: "Sap is falling: plant fruit trees and bushes; set out strawberry plants." },
    },
    winter: {
      root:   { up: "Sap is rising: harvest the hardy roots still in the ground — parsnips, Jerusalem artichokes, carrots.",
                down: "Sap is falling: rest the soil; force chicory, plant garlic in mild areas." },
      leaf:   { up: "Sap is rising: harvest leeks, lamb's lettuce, spinach and winter cabbages.",
                down: "Sap is falling: sow early salads under cover; mulch the beds." },
      flower: { up: "Sap is rising: little to pick — tidy and plan the ornamental garden.",
                down: "Sap is falling: plant bare-root flowering shrubs; prune in mild spells." },
      fruit:  { up: "Sap is rising: little to harvest — check your stored fruit.",
                down: "Sap is falling: plant bare-root fruit trees; prune fruit trees and the vine." },
    },
  },
};

const REST: Record<Lang, string> = {
  fr: "Jour de nœud lunaire : la tradition conseille de laisser le jardin au repos — évitez aujourd'hui semis et plantations.",
  en: "Lunar node day: tradition advises letting the garden rest — avoid sowing and planting today.",
};

const TITLE: Record<Lang, string> = { fr: "Au jardin aujourd'hui", en: "In the garden today" };

// On parle de SÈVE (montante/descendante), pas de « Lune montante » : ça évite
// la confusion avec la phase croissante/décroissante, qui est un AUTRE cycle
// (déclinaison ~13,6 j vs illumination ~29,5 j — les deux peuvent diverger,
// p.ex. Pleine Lune + sève montante le même jour).
const SAP: Record<Lang, { up: string; down: string }> = {
  fr: { up: "Sève montante", down: "Sève descendante" },
  en: { up: "Rising sap", down: "Falling sap" },
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

// ── Calendrier : JD → mois → saison ───────────────────────────

/** Mois civil (1–12) d'un JD UT (algorithme de Meeus, ch.7, inverse). */
function jdToMonth(JD: number): number {
  const z = Math.floor(JD + 0.5);
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  return e < 14 ? e - 1 : e - 13;
}

/** Mois → saison, en inversant pour l'hémisphère sud (+6 mois). */
function monthToSeason(month: number, hemisphere: Hemisphere): GardeningSeason {
  const m = hemisphere === "south" ? ((month + 5) % 12) + 1 : month;
  if (m >= 3 && m <= 5)  return "spring";
  if (m >= 6 && m <= 8)  return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

/**
 * Calcule le conseil jardinier du jour.
 *
 * @param moonSignIdx  Index du signe lunaire (0 Bélier … 11 Poissons).
 * @param moonPhaseKey Clé de phase (`moonPhase().key`) pour croissante/décroissante.
 * @param JD           Jour julien du moment (ex. `currentSky.JD`) — sert aussi
 *                     à dériver la saison.
 * @param latitude     Latitude (deg) pour l'hémisphère ; < 0 = sud. Défaut nord.
 * @param locale       "fr" (défaut) ou "en".
 */
export function lunarGardening(args: {
  moonSignIdx: number;
  moonPhaseKey: string;
  JD: number;
  latitude?: number;
  locale?: string;
}): LunarGardeningTip {
  const lang: Lang = args.locale === "en" ? "en" : "fr";
  const idx = ((args.moonSignIdx % 12) + 12) % 12;
  const dayType = SIGN_DAY_TYPE[idx]!;

  // Sève : tendance de la déclinaison sur ±0,3 jour autour du moment.
  const ascending = moonDeclination(args.JD + 0.3) > moonDeclination(args.JD - 0.3);

  // Phase d'illumination (indicatif, exposé dans la donnée mais PAS dans le
  // texte de la carte : elle vit déjà dans la carte « Phase lunaire » en haut,
  // et l'afficher ici à côté de la sève prêtait à confusion).
  const waxing = WAXING_KEYS.has(args.moonPhaseKey);

  // Saison (pour des cultures de saison), hémisphère selon la latitude.
  const hemisphere: Hemisphere = (args.latitude ?? 0) < 0 ? "south" : "north";
  const season = monthToSeason(jdToMonth(args.JD), hemisphere);

  // Jour de nœud : la Lune traverse l'écliptique (latitude ≈ 0).
  const lat = moonLat((args.JD - 2451545) / 36525);
  const rest = Math.abs(lat) < 0.5;

  const sap = ascending ? SAP[lang].up : SAP[lang].down;
  const advice = rest
    ? REST[lang]
    : ADVICE[lang][season][dayType][ascending ? "up" : "down"];

  return {
    dayType,
    dayTypeLabel: LABELS[lang][dayType],
    emoji: EMOJI[dayType],
    ascending,
    waxing,
    season,
    rest,
    title: TITLE[lang],
    advice,
    detail: sap,
  };
}

// LUNAR-GARDENING-V1 applied
