// ============================================================
// aspects.ts — Tables d'aspects canoniques et calcul des aspects
// ------------------------------------------------------------
// ASTRO-ENGINE-SPLIT-V1 : extrait de astro-engine.ts (déplacement
// pur, zéro changement de logique).
// ============================================================

import { type PlanetPosition } from "./engine-core.js";

// ──────────────────────────────────────────────────────────
// Types d'aspects
// ──────────────────────────────────────────────────────────
export interface AspectType {
  type:  "conjunction" | "sextile" | "square" | "trine" | "opposition" | "quincunx"
       // ASPECTS-MINEURS-V1 : aspects mineurs (moteur natal uniquement)
       | "semisextile" | "semisquare" | "sesquiquadrate" | "quintile";
  nameFr: string;
  angle: number;
  orb:   number;
  tone:  "h" | "t" | "n";
  symbol: string;
}

// C1-FIX : TABLE D'ASPECTS CANONIQUE — source unique de vérité.
// Les moteurs de transits et de synastrie (apps/api) en dérivent leurs
// propres tables : angles/symboles/tonalités identiques, orbes ajustés
// par contexte (les transits sont volontairement plus serrés).
// Ne pas redéfinir cette liste ailleurs — l'importer.
export const ASPECT_TYPES: AspectType[] = [
  { type: "conjunction", nameFr: "Conjonction", angle: 0,   orb: 8, tone: "n", symbol: "☌" },
  { type: "sextile",     nameFr: "Sextile",     angle: 60,  orb: 6, tone: "h", symbol: "⚹" },
  { type: "square",      nameFr: "Carré",       angle: 90,  orb: 7, tone: "t", symbol: "□" },
  { type: "trine",       nameFr: "Trigone",     angle: 120, orb: 8, tone: "h", symbol: "△" },
  { type: "opposition",  nameFr: "Opposition",  angle: 180, orb: 8, tone: "t", symbol: "☍" },
  { type: "quincunx",    nameFr: "Quinconce",   angle: 150, orb: 3, tone: "t", symbol: "⚻" },
];

// ASPECTS-MINEURS-V1 : aspects mineurs — réservés au moteur NATAL.
// Délibérément HORS de la table canonique ASPECT_TYPES (que transits et
// synastrie dérivent via C1-FIX) : les mineurs nuancent une lecture de
// thème natal, mais ajouteraient du bruit en transit et fausseraient le
// score de synastrie. Orbes serrés (2°).
export const MINOR_ASPECT_TYPES: AspectType[] = [
  { type: "semisextile",    nameFr: "Semi-sextile", angle: 30,  orb: 2, tone: "n", symbol: "⚺" },
  { type: "semisquare",     nameFr: "Semi-carré",   angle: 45,  orb: 2, tone: "t", symbol: "∠" },
  { type: "sesquiquadrate", nameFr: "Sesqui-carré", angle: 135, orb: 2, tone: "t", symbol: "⚼" },
  { type: "quintile",       nameFr: "Quintile",     angle: 72,  orb: 2, tone: "n", symbol: "Q" },
];

/** Aspects pris en compte par le calcul natal : canoniques + mineurs. */
const NATAL_ASPECT_TYPES: AspectType[] = [...ASPECT_TYPES, ...MINOR_ASPECT_TYPES];

// ──────────────────────────────────────────────────────────
// Aspects
// ──────────────────────────────────────────────────────────
export interface Aspect {
  p1:       string;
  p2:       string;
  type:     AspectType["type"];
  typeFr:   string;
  angle:    number;
  orb:      number;       // écart à l'angle exact
  exact:    boolean;
  symbol:   string;
  tone:     "h" | "t" | "n";
}

export function calculateAspects(pos: Record<string, PlanetPosition>): Aspect[] {
  // ASTEROIDS-V1 : Cérès/Pallas/Junon/Vesta + Lilith vraie sont exclus de la
  // GRILLE d'aspects natale — leurs aspects noieraient le top-N (par orbe)
  // envoyé au LLM et affiché, au détriment des planètes. Ils restent présents
  // en POSITIONS (signe/maison) partout, et leurs aspects de transit→natal
  // restent calculés ailleurs (transits.service). Chiron et la Lilith moyenne
  // restent aspectés (1 corps chacun, signifiants, déjà le cas en astracore).
  const skip = new Set([
    "northNode", "southNode", "fortune",
    "ceres", "pallas", "juno", "vesta", "lilithTrue",
  ]);
  const keys = Object.keys(pos).filter(k => !skip.has(k));
  const out: Aspect[] = [];

  for (let i = 0; i < keys.length - 1; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const k1 = keys[i]!, k2 = keys[j]!;
      let d = Math.abs(pos[k1]!.longitude - pos[k2]!.longitude);
      if (d > 180) d = 360 - d;

      for (const a of NATAL_ASPECT_TYPES) {   // ASPECTS-MINEURS-V1 : majeurs + mineurs
        const isLum = k1 === "sun" || k1 === "moon" || k2 === "sun" || k2 === "moon";
        const maxOrb = a.orb + (isLum ? 2 : 0);
        const o = Math.abs(d - a.angle);
        if (o <= maxOrb) {
          out.push({
            p1: k1, p2: k2,
            type: a.type, typeFr: a.nameFr,
            angle: a.angle, orb: o, exact: o < 1,
            symbol: a.symbol, tone: a.tone,
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.orb - b.orb);
}

// ASTRO-ENGINE-SPLIT-V1 applied
