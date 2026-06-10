// ============================================================
// lots.ts — Part de Fortune et Lots hermétiques
// ------------------------------------------------------------
// ASTRO-ENGINE-SPLIT-V1 : extrait de astro-engine.ts (déplacement
// pur, zéro changement de logique).
// ============================================================

import { n360, type PlanetPosition } from "./engine-core.js";

// ──────────────────────────────────────────────────────────
// Part de Fortune
// ──────────────────────────────────────────────────────────
export function partOfFortune(sunLon: number, moonLon: number, asc: number, isNight: boolean): number {
  return isNight
    ? n360(asc + sunLon  - moonLon)
    : n360(asc + moonLon - sunLon);
}

// ──────────────────────────────────────────────────────────
// POINTS-ARABES-V1 — Sept Lots hermétiques (Paulus Alexandrinus, IVe s.)
// ──────────────────────────────────────────────────────────
export interface HermeticLots {
  fortune:   number;
  spirit:    number;
  eros:      number;
  necessity: number;
  courage:   number;
  victory:   number;
  nemesis:   number;
}

/**
 * Calcule les 7 Lots hermétiques de Paulus Alexandrinus.
 * Chaque lot = (Asc + a − b) le jour, (Asc + b − a) la nuit :
 *   Fortune   = Asc + Lune − Soleil      Esprit  = Asc + Soleil − Lune
 *   Éros      = Asc + Vénus − Esprit     Victoire = Asc + Jupiter − Esprit
 *   Nécessité = Asc + Fortune − Mercure  Courage  = Asc + Fortune − Mars
 *   Némésis   = Asc + Fortune − Saturne
 *
 * `fortune` est passé pré-calculé (cf. partOfFortune) pour garantir
 * lots.fortune === planets.fortune. `isNight` DOIT être le même flag
 * que celui utilisé pour la Part de Fortune.
 */
export function computeHermeticLots(
  asc:     number,
  planets: Record<string, PlanetPosition>,
  isNight: boolean,
  fortune: number,
): HermeticLots {
  const lon = (k: string): number => planets[k]?.longitude ?? 0;
  // lot(a, b) : jour → Asc + a − b ; nuit → Asc + b − a
  const lot = (a: number, b: number): number =>
    n360(isNight ? asc + b - a : asc + a - b);

  const spirit = lot(lon("sun"), lon("moon"));
  return {
    fortune,
    spirit,
    eros:      lot(lon("venus"),   spirit),
    necessity: lot(fortune,        lon("mercury")),
    courage:   lot(fortune,        lon("mars")),
    victory:   lot(lon("jupiter"), spirit),
    nemesis:   lot(fortune,        lon("saturn")),
  };
}

// ASTRO-ENGINE-SPLIT-V1 applied
