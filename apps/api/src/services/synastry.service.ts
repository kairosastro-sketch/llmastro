// ============================================================
// synastry.service.ts — Calcul des aspects inter-planétaires
// entre deux thèmes natals + scoring 6 dimensions.
// ------------------------------------------------------------
// Fonctions pures, pas d'I/O. Prend en entrée les dictionnaires
// de planètes {longitude, signIdx, ...} de deux charts distincts.
// ============================================================

import { ASPECT_TYPES as CANONICAL_ASPECTS } from "@astro-platform/ephemeris";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export interface SynastryAspect {
  planetA:      string;                // ex. "venus"
  planetB:      string;                // ex. "mars"
  type:         AspectType;
  orb:          number;                // déviation absolue à l'exact, en degrés
  tone:         "h" | "t" | "n";       // harmonique / tendu / neutre
  contribution: number;                // poids final (signé : +/-)
}

export type AspectType =
  | "conjunction" | "sextile" | "square" | "trine" | "opposition" | "quincunx";

export interface SynastryScores {
  global: number;                      // 0-100
  dimensions: {
    love:          number;             // romance, attraction
    communication: number;             // échanges mentaux
    intimacy:      number;             // résonance émotionnelle
    stability:     number;             // capacité à durer
    growth:        number;             // croissance mutuelle
    challenges:    number;             // frictions (haut = plus de friction)
  };
}

// ──────────────────────────────────────────────────────────
// Définitions astrologiques
// ──────────────────────────────────────────────────────────

// C1-FIX : table dérivée de la table canonique du package ephemeris
// (source unique). La synastrie compare deux thèmes natals → elle utilise
// les mêmes orbes que le natal. Corrige l'ancien carré à 8° (dérive
// accidentelle : le natal est à 7°) et ajoute le quinconce, absent jusqu'ici.
const ASPECT_DEFS: Array<{ type: AspectType; angle: number; orb: number; tone: "h" | "t" | "n" }> =
  CANONICAL_ASPECTS.map((a) => ({
    type:  a.type,
    angle: a.angle,
    orb:   a.orb,
    tone:  a.tone,
  }));

const PLANET_WEIGHTS: Record<string, number> = {
  sun:     1.0, moon:    1.0, venus:   0.9, mars:    0.9,
  mercury: 0.7, saturn:  0.7, jupiter: 0.6, pluto:   0.5,
  uranus:  0.4, neptune: 0.4,
};

const PLANET_KEYS = Object.keys(PLANET_WEIGHTS);

// Paires planète-planète qui contribuent à chaque dimension.
// L'ordre dans la paire ne compte pas (aspect A↔B traité comme non-orienté).
type PlanetPair = [string, string];
const DIMENSION_PAIRS: Record<keyof SynastryScores["dimensions"], PlanetPair[]> = {
  love: [
    ["venus", "mars"],   ["venus", "venus"],
    ["sun",   "moon"],   ["moon",  "venus"],
    ["mars",  "mars"],
  ],
  communication: [
    ["mercury", "mercury"], ["mercury", "sun"],
    ["mercury", "moon"],    ["mercury", "mars"],
  ],
  intimacy: [
    ["moon",  "moon"], ["moon", "sun"],
    ["moon",  "venus"],["sun",  "sun"],
  ],
  stability: [
    ["saturn", "sun"],    ["saturn", "moon"],
    ["saturn", "saturn"], ["saturn", "venus"],
  ],
  growth: [
    ["jupiter", "sun"],   ["jupiter", "moon"],
    ["jupiter", "venus"], ["jupiter", "jupiter"],
  ],
  challenges: [
    ["mars", "saturn"], ["mars", "pluto"],
    ["pluto", "sun"],   ["pluto", "moon"],   ["pluto", "venus"],
  ],
};

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function aspectInvolvesPair(aspect: SynastryAspect, pair: PlanetPair): boolean {
  const [p1, p2] = pair;
  return (
    (aspect.planetA === p1 && aspect.planetB === p2) ||
    (aspect.planetA === p2 && aspect.planetB === p1)
  );
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

/**
 * Calcule tous les aspects inter-planétaires A↔B, triés par magnitude
 * de contribution décroissante.
 *
 * @param planetsA  Planètes de la personne A (dict par clé)
 * @param planetsB  Planètes de la personne B (dict par clé)
 * @param opts.excludeMoon  Si vrai, ignore la Lune dans les calculs
 *                          (utilisé quand une heure de naissance est inconnue).
 */
export function computeSynastryAspects(
  planetsA: Record<string, { longitude: number }>,
  planetsB: Record<string, { longitude: number }>,
  opts: { excludeMoon?: boolean } = {},
): SynastryAspect[] {
  const excludeMoon = opts.excludeMoon ?? false;
  const aspects: SynastryAspect[] = [];

  for (const keyA of PLANET_KEYS) {
    if (excludeMoon && keyA === "moon") continue;
    const pA = planetsA[keyA];
    if (!pA || typeof pA.longitude !== "number") continue;

    for (const keyB of PLANET_KEYS) {
      if (excludeMoon && keyB === "moon") continue;
      const pB = planetsB[keyB];
      if (!pB || typeof pB.longitude !== "number") continue;

      // Distance angulaire 0-180°
      const diff = Math.abs(pA.longitude - pB.longitude);
      const dist = Math.min(diff, 360 - diff);

      // Premier aspect dans l'orbe gagne
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(dist - def.angle);
        if (orb <= def.orb) {
          const base = def.tone === "h" ? 10 : def.tone === "t" ? -6 : 4;
          const orbMul = 1 + (1 - orb / def.orb) * 0.5;
          const wA = PLANET_WEIGHTS[keyA] ?? 0.3;
          const wB = PLANET_WEIGHTS[keyB] ?? 0.3;
          const contribution = Math.round(base * orbMul * wA * wB * 10) / 10;

          aspects.push({
            planetA: keyA,
            planetB: keyB,
            type:    def.type,
            orb:     Math.round(orb * 10) / 10,
            tone:    def.tone,
            contribution,
          });
          break;
        }
      }
    }
  }

  aspects.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return aspects;
}

/**
 * Score de synastrie en 6 dimensions + global, à partir des aspects.
 * Normalise chaque dimension en 0-100 (clamp 5..95).
 *
 * Sémantique de "challenges" : HAUT = plus de frictions = moins bon.
 * C'est inversé dans le calcul du global (on utilise 100 - challenges
 * comme "harmonie" pour mixer avec les 5 autres dimensions).
 */
export function scoreSynastry(
  aspects: SynastryAspect[],
  _opts: { degraded?: boolean } = {},
): SynastryScores {
  const raw = {
    love:          0,
    communication: 0,
    intimacy:      0,
    stability:     0,
    growth:        0,
    challenges:    0,
  };

  for (const asp of aspects) {
    for (const dim of Object.keys(raw) as Array<keyof typeof raw>) {
      const pairs = DIMENSION_PAIRS[dim];

      if (dim === "challenges") {
        // Challenges : tous les aspects tendus comptent (avec leur magnitude),
        // + bonus pour les paires spécifiques.
        if (asp.tone === "t") {
          raw[dim] += Math.abs(asp.contribution);
        }
        if (pairs.some(p => aspectInvolvesPair(asp, p))) {
          raw[dim] += Math.abs(asp.contribution) * 0.5;
        }
      } else {
        // Dimensions positives : seulement les aspects qui impliquent
        // les paires pertinentes contribuent (avec leur signe).
        if (pairs.some(p => aspectInvolvesPair(asp, p))) {
          raw[dim] += asp.contribution;
        }
      }
    }
  }

  const clamp = (n: number) => Math.max(5, Math.min(95, Math.round(n)));

  const dimensions = {
    love:          clamp(50 + raw.love          * 0.4),
    communication: clamp(50 + raw.communication * 0.4),
    intimacy:      clamp(50 + raw.intimacy      * 0.4),
    stability:     clamp(50 + raw.stability     * 0.4),
    growth:        clamp(50 + raw.growth        * 0.4),
    challenges:    clamp(30 + raw.challenges    * 0.3),
  };

  // Global : moyenne des 5 dimensions positives + (100 - challenges),
  // pondérée par la "vibe" globale des aspects.
  const harmonyInverted = 100 - dimensions.challenges;
  const meanDims = (
    dimensions.love +
    dimensions.communication +
    dimensions.intimacy +
    dimensions.stability +
    dimensions.growth +
    harmonyInverted
  ) / 6;

  const totalContrib = aspects.reduce((s, a) => s + a.contribution, 0);
  const aspectVibe = clamp(50 + totalContrib * 0.1);

  const global = clamp(meanDims * 0.7 + aspectVibe * 0.3);

  return { global, dimensions };
}
