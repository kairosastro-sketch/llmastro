// ============================================================
// apps/web/src/lib/astro-dignities.ts — DIGNITES-V1
// ------------------------------------------------------------
// Dignités essentielles : domicile, exaltation, exil (détriment),
// chute. Table traditionnelle (Ptolémée) avec rulerships MODERNES
// — cohérent avec le positionnement « astrologie occidentale
// moderne » du produit (Uranus/Neptune/Pluton maîtrisent
// Verseau/Poissons/Scorpion).
//
// Lookup pur : clé de planète + index de signe → dignité.
// Aucun calcul astronomique.
// ============================================================

export type DignityKind =
  | "domicile" | "exaltation" | "detriment" | "fall" | "peregrine";

// Index des signes : Bélier = 0 … Poissons = 11.
const opposite = (sign: number): number => (sign + 6) % 12;

// Domicile — signes maîtrisés par chaque planète (rulerships modernes).
// Mercure et Vénus en gardent deux ; les autres un seul.
const DOMICILE: Record<string, number[]> = {
  sun:     [4],       // Lion
  moon:    [3],       // Cancer
  mercury: [2, 5],    // Gémeaux, Vierge
  venus:   [1, 6],    // Taureau, Balance
  mars:    [0],       // Bélier
  jupiter: [8],       // Sagittaire
  saturn:  [9],       // Capricorne
  uranus:  [10],      // Verseau
  neptune: [11],      // Poissons
  pluto:   [7],       // Scorpion
};

// Exaltation — un signe par planète. Tradition : 7 planètes classiques
// uniquement (pas d'exaltation standard pour Uranus/Neptune/Pluton —
// on n'en invente pas).
const EXALTATION: Record<string, number> = {
  sun:     0,         // Bélier
  moon:    1,         // Taureau
  mercury: 5,         // Vierge
  venus:   11,        // Poissons
  mars:    9,         // Capricorne
  jupiter: 3,         // Cancer
  saturn:  6,         // Balance
};

// Score de dignité (domicile fort → +5, chute → −4…).
const DIGNITY_SCORE: Record<DignityKind, number> = {
  domicile: 5, exaltation: 4, detriment: -5, fall: -4, peregrine: 0,
};

export interface DignityResult {
  kind:  DignityKind;
  score: number;
}

/**
 * Dignité essentielle d'une planète dans un signe donné.
 * Retourne `null` si la planète n'a pas de dignités essentielles
 * (nœuds lunaires, Chiron, Lilith, Part de Fortune…).
 *
 * Priorité de résolution : domicile > exaltation > exil > chute.
 * (Mercure en Vierge est à la fois domicile et exaltation — on
 *  affiche « domicile », la dignité la plus forte.)
 */
export function computeDignity(
  planetKey: string,
  signIdx: number,
): DignityResult | null {
  const key = planetKey.toLowerCase();
  const domicile = DOMICILE[key];
  if (!domicile) return null;                  // pas une des 10 planètes
  if (!Number.isInteger(signIdx) || signIdx < 0 || signIdx > 11) return null;

  const exalt = EXALTATION[key];

  let kind: DignityKind = "peregrine";
  if (domicile.includes(signIdx)) {
    kind = "domicile";
  } else if (exalt === signIdx) {
    kind = "exaltation";
  } else if (domicile.map(opposite).includes(signIdx)) {
    kind = "detriment";
  } else if (exalt !== undefined && opposite(exalt) === signIdx) {
    kind = "fall";
  }

  return { kind, score: DIGNITY_SCORE[kind] };
}

// DIGNITES-V1 applied
