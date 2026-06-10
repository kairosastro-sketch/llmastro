// ============================================================
// vsop.ts — Théorie planétaire (VSOP-like simplifié)
// ------------------------------------------------------------
// ASTRO-ENGINE-SPLIT-V1 : extrait de astro-engine.ts (déplacement
// pur, zéro changement de logique). Éléments orbitaux, positions
// héliocentriques 3D, conversions géocentriques et détection
// rétrograde des planètes.
// ============================================================

import { R, D, n360, solveKepler } from "./engine-core.js";

// ──────────────────────────────────────────────────────────
// Éléments orbitaux (VSOP-like simplifiés)
// ──────────────────────────────────────────────────────────
interface OrbitalElement {
  L0: number; L1: number;   // longitude moyenne
  p0: number; p1: number;   // longitude du périhélie (arcsec)
  e0: number; e1: number;   // excentricité
  a:  number;               // demi-grand axe (AU)
  i:  number;               // inclinaison (deg)
  Om: number;               // longitude nœud ascendant (deg)
}

const PE: Record<string, OrbitalElement> = {
  earth:   { L0: 100.46646,  L1: 36000.76983, p0: 102.937, p1: 1198,  e0: 0.01671, e1: -0.0000420, a: 1.00000, i: 0,      Om: 0       },
  mercury: { L0: 252.2503,   L1: 149472.675,  p0: 77.456,  p1: 5719,  e0: 0.20563, e1: 0.0000204,  a: 0.38710, i: 7.005,  Om: 48.331  },
  venus:   { L0: 181.9798,   L1: 58517.816,   p0: 131.564, p1: 175,   e0: 0.00677, e1: -0.0000478, a: 0.72334, i: 3.395,  Om: 76.680  },
  mars:    { L0: 355.4333,   L1: 19140.299,   p0: 336.060, p1: 15843, e0: 0.09340, e1: 0.0000905,  a: 1.52371, i: 1.850,  Om: 49.558  },
  jupiter: { L0: 34.3515,    L1: 3034.906,    p0: 14.331,  p1: 7759,  e0: 0.04839, e1: 0.000163,   a: 5.20289, i: 1.303,  Om: 100.464 },
  saturn:  { L0: 50.0775,    L1: 1222.114,    p0: 93.057,  p1: 12722, e0: 0.05551, e1: -0.000347,  a: 9.53668, i: 2.489,  Om: 113.665 },
  uranus:  { L0: 314.055,    L1: 428.467,     p0: 173.005, p1: 4207,  e0: 0.04630, e1: -0.0000273, a: 19.1892, i: 0.773,  Om: 74.006  },
  neptune: { L0: 304.349,    L1: 218.486,     p0: 48.123,  p1: 5766,  e0: 0.00899, e1: 0.0000064,  a: 30.0699, i: 1.770,  Om: 131.784 },
  pluto:   { L0: 238.929,    L1: 145.208,     p0: 224.067, p1: 4223,  e0: 0.24883, e1: 0.00006,    a: 39.4821, i: 17.16,  Om: 110.303 },
  chiron:  { L0: 209.39,     L1: 26098.35,    p0: 339.47,  p1: 5765,  e0: 0.3789,  e1: 0,          a: 13.648,  i: 6.93,   Om: 209.21  },
};

// LILITH-V1 : Lilith (Mean Apogee) n'est PAS calculée par astro-engine
// (mode Meeus/VSOP, sans data files). Elle n'apparaît dans les positions
// que quand ASTRO_ENGINE=swisseph est actif. Le code consommateur doit
// gérer l'absence (Object.entries(planets) itère naturellement sur ce qui
// est présent — pas de crash, juste pas d'affichage).
export const OUTER_PLANETS = ["mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","chiron"] as const;

// ──────────────────────────────────────────────────────────
// Position héliocentrique 3D d'une planète
// ──────────────────────────────────────────────────────────
export interface Pos3D { x: number; y: number; z: number; lon: number; r: number; }

export function helioPos3D(key: string, T: number): Pos3D {
  const e = PE[key];
  if (!e) return { x: 0, y: 0, z: 0, lon: 0, r: 0 };

  const L    = n360(e.L0 + e.L1 * T);
  const peri = n360(e.p0 + (e.p1 * T) / 3600);
  const ecc  = e.e0 + e.e1 * T;
  const M    = n360(L - peri);
  const E    = solveKepler(M, ecc);

  const v = 2 * Math.atan2(
    Math.sqrt(1 + ecc) * Math.sin(E / 2),
    Math.sqrt(1 - ecc) * Math.cos(E / 2),
  ) * D;

  const hLon = n360(v + peri);
  const r    = e.a * (1 - ecc * Math.cos(E));
  const inc  = e.i  * R;
  const Om   = e.Om * R;
  const lon  = hLon * R;

  return {
    x: r * (Math.cos(Om) * Math.cos(lon - Om) - Math.sin(Om) * Math.sin(lon - Om) * Math.cos(inc)),
    y: r * (Math.sin(Om) * Math.cos(lon - Om) + Math.cos(Om) * Math.sin(lon - Om) * Math.cos(inc)),
    z: r *  Math.sin(lon - Om) * Math.sin(inc),
    lon: hLon,
    r,
  };
}

/** Conversion héliocentrique → géocentrique (longitude uniquement). */
export function helioToGeoLon(p: Pos3D, e: Pos3D): number {
  const xg = p.x - e.x;
  const yg = p.y - e.y;
  return n360(Math.atan2(yg, xg) * D);
}

/**
 * ASTROCARTOGRAPHY-V1 — Conversion héliocentrique → géocentrique avec
 * longitude ET latitude écliptiques (degrés). La latitude vient de la
 * composante z du vecteur géocentrique : indispensable pour l'astro-
 * cartographie (sinon les planètes à forte latitude écliptique — Pluton
 * ±17° — auraient une déclinaison fausse).
 */
export function helioToGeoLonLat(p: Pos3D, e: Pos3D): { lon: number; lat: number } {
  const xg = p.x - e.x;
  const yg = p.y - e.y;
  const zg = p.z - e.z;
  return {
    lon: n360(Math.atan2(yg, xg) * D),
    lat: Math.atan2(zg, Math.hypot(xg, yg)) * D,
  };
}

// ──────────────────────────────────────────────────────────
// Détection rétrograde (compare longitudes J et J+1)
// ──────────────────────────────────────────────────────────
export function isRetrograde(key: string, JD: number): boolean {
  if (!(key in PE)) return false;
  // B2-FIX : différence finie CENTRÉE sur JD (±0,5 j). L'ancienne
  // différence "avant" (JD → JD+1) plaçait les stations ~12 h trop tôt :
  // le passage par zéro de la vitesse moyenne tombe au milieu de la
  // fenêtre. Centrer la fenêtre supprime ce biais systématique.
  const T1 = (JD - 0.5 - 2451545) / 36525;
  const T2 = (JD + 0.5 - 2451545) / 36525;
  const e1 = helioPos3D("earth", T1), e2 = helioPos3D("earth", T2);
  const p1 = helioPos3D(key,     T1), p2 = helioPos3D(key,     T2);
  const g1 = helioToGeoLon(p1, e1);
  const g2 = helioToGeoLon(p2, e2);
  let diff = g2 - g1;
  if (diff >  180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

// ASTRO-ENGINE-SPLIT-V1 applied
