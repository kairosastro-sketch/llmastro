// ============================================================
// engine-core.ts — Constantes, helpers de base et types partagés
// ------------------------------------------------------------
// ASTRO-ENGINE-SPLIT-V1 : extrait de astro-engine.ts (déplacement
// pur, zéro changement de logique). Module racine du moteur
// AstraCore — ne doit importer AUCUN autre module du moteur.
// ============================================================

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────
export const PI = Math.PI;
export const R  = PI / 180;   // deg → rad
export const D  = 180 / PI;   // rad → deg

export type ZodiacSystem = "tropical" | "sidereal";
export type HouseSystem  = "placidus" | "equal" | "whole_sign" | "koch";

export interface CityCoords { lat: number; lng: number; tz: number; }

// EPHEMERIS-DEEP-CONSOLIDATION-V1 : suppression de l'objet CITIES
// (148 villes hardcodées) et de getCity() qui throw. Code mort
// confirmé : aucun appelant externe au package, déjà neutralisé.
// Le type CityCoords (utilisé en interne par les fonctions de
// calcul des maisons) reste exporté.

// ──────────────────────────────────────────────────────────
// Positions planétaires — type partagé par tous les modules
// ──────────────────────────────────────────────────────────
export interface PlanetPosition {
  key:       string;
  longitude: number;   // 0-360 écliptique
  signIdx:   number;   // 0-11
  degree:    number;   // 0-30 dans le signe
  retrograde?: boolean;
  house?:     number;
}

// ──────────────────────────────────────────────────────────
// Helpers de base
// ──────────────────────────────────────────────────────────
export function n360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/**
 * Jour julien (algorithme de Fliegel & Van Flandern).
 * y,m,d = date grégorienne ; h = heure UT décimale
 */
export function jd(y: number, m: number, d: number, h = 0): number {
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100);
  return Math.floor(365.25 * (y + 4716))
       + Math.floor(30.6001 * (m + 1))
       + d + h / 24
       + (2 - A + Math.floor(A / 4))
       - 1524.5;
}

/** Nutation en longitude (degrés). */
export function nutLon(T: number): number {
  const O  = (125.04  - 1934.136 * T) * R;
  const L  = (280.4665 + 36000.7698 * T) * R;
  const Lp = (218.3165 + 481267.8813 * T) * R;
  return (-17.2 * Math.sin(O)
          -  1.32 * Math.sin(2 * L)
          -  0.23 * Math.sin(2 * Lp)
          +  0.21 * Math.sin(2 * O)) / 3600;
}

/** Obliquité moyenne de l'écliptique (degrés). */
export function obl(T: number): number {
  return 23.439291 - 0.013004 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
}

/** Kepler itératif (Newton). */
export function solveKepler(Mdeg: number, e: number): number {
  const M = Mdeg * R;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 200; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// ASTRO-ENGINE-SPLIT-V1 applied
