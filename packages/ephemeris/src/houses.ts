// ============================================================
// houses.ts — Temps sidéral, ASC/MC et systèmes de maisons
// ------------------------------------------------------------
// ASTRO-ENGINE-SPLIT-V1 : extrait de astro-engine.ts (déplacement
// pur, zéro changement de logique). GMST/LST, Ascendant, Milieu
// du Ciel, maisons Placidus/Égales/Signe entier/Koch.
// ============================================================

import { R, D, n360, obl, type HouseSystem } from "./engine-core.js";

// ──────────────────────────────────────────────────────────
// Temps sidéral → Ascendant + Milieu du Ciel
// ──────────────────────────────────────────────────────────
function gmst(JD: number): number {
  const T = (JD - 2451545) / 36525;
  return n360(280.46061837
            + 360.98564736629 * (JD - 2451545)
            + 0.000387933 * T * T
            - T * T * T / 38710000);
}

function lst(JD: number, lng: number): number {
  return n360(gmst(JD) + lng);
}

/** ASTROCARTOGRAPHY-V1 — Temps sidéral de Greenwich (degrés) pour un JD UT. */
export function gmstDeg(JD: number): number {
  return gmst(JD);
}

/** ASTROCARTOGRAPHY-V1 — Obliquité moyenne de l'écliptique (degrés) pour un JD UT. */
export function obliquityDeg(JD: number): number {
  return obl((JD - 2451545) / 36525);
}

function calcASC(RAMC: number, lat: number, ob: number): number {
  const t = RAMC * R, l = lat * R, e = ob * R;
  return n360(Math.atan2(Math.cos(t), -(Math.sin(t) * Math.cos(e) + Math.tan(l) * Math.sin(e))) * D);
}

function calcMC(RAMC: number, ob: number): number {
  const t = RAMC * R, e = ob * R;
  let mc = Math.atan2(Math.sin(t), Math.cos(t) * Math.cos(e)) * D;
  if (Math.cos(t) < 0) mc += 180;
  return n360(mc);
}

// ──────────────────────────────────────────────────────────
// Systèmes de maisons
// ──────────────────────────────────────────────────────────
/** Placidus itératif (convergence par Newton). */
function placidusHouses(RAMC: number, lat: number, ob: number): number[] {
  const asc = calcASC(RAMC, lat, ob);
  const mc  = calcMC(RAMC, ob);
  const c: number[] = new Array(12).fill(0);
  c[0] = asc; c[9] = mc; c[3] = n360(mc + 180); c[6] = n360(asc + 180);

  const ee = ob  * R;
  const ll = lat * R;

  function pCusp(f: number): number {
    let cusp = RAMC + f * 90;
    for (let it = 0; it < 50; it++) {
      const cr   = n360(cusp) * R;
      const decl = Math.asin(Math.sin(ee) * Math.sin(cr));
      const AD   = Math.abs(lat) < 1 ? 0
                 : Math.atan2(Math.sin(ll) * Math.sin(decl), Math.cos(decl));
      const nc = RAMC + f * (90 + AD * D);
      if (Math.abs(nc - cusp) < 0.001) break;
      cusp = nc;
    }
    const cr = n360(cusp) * R;
    let lon = Math.atan2(Math.sin(cr), Math.cos(cr) * Math.cos(ee)) * D;
    if (Math.cos(cr) < 0) lon += 180;
    return n360(lon);
  }

  try {
    c[10] = pCusp(1 / 3);
    c[11] = pCusp(2 / 3);
    c[1]  = pCusp(1 + 1 / 3);
    c[2]  = pCusp(1 + 2 / 3);
  } catch {
    const d1 = n360(asc - mc);
    const d2 = n360(mc + 180 - asc);
    c[10] = n360(mc + d1 / 3);
    c[11] = n360(mc + 2 * d1 / 3);
    c[1]  = n360(asc + d2 / 3);
    c[2]  = n360(asc + 2 * d2 / 3);
  }

  c[4] = n360(c[10]! + 180);
  c[5] = n360(c[11]! + 180);
  c[7] = n360(c[1]!  + 180);
  c[8] = n360(c[2]!  + 180);
  return c;
}

function equalHouses(asc: number): number[] {
  return Array.from({ length: 12 }, (_, i) => n360(asc + i * 30));
}

function wholeSignHouses(asc: number): number[] {
  const base = Math.floor(asc / 30) * 30;
  return Array.from({ length: 12 }, (_, i) => n360(base + i * 30));
}

function kochHouses(RAMC: number, lat: number, ob: number): number[] {
  // Koch : une variante simplifiée proche de Placidus pour l'instant
  // (le template n'implémente pas explicitement Koch, on fallback sur Placidus)
  return placidusHouses(RAMC, lat, ob);
}

export interface HouseSet {
  cusps: number[];
  asc:   number;
  mc:    number;
  /** VERTEX-V1 : Vertex écliptique (deg 0–360). Fourni par Swiss
   *  Ephemeris ; `null` en mode astracore (moteur de secours — le
   *  Vertex n'y est pas calculé, on ne devine pas la formule). */
  vertex: number | null;
  system: HouseSystem;
}

export function calculateHouses(
  _system: HouseSystem,
  _JD: number,
  _city: string,
): HouseSet {
  // CI-DEBT-PURGE-V1-C: getCity() retiré par EPHEMERIS-DEEP-CONSOLIDATION-V1.
  // Cette signature legacy est inutilisable. Utiliser la version coord-directe :
  //   calculateHousesByCoords(system, JD, lat, lng)
  throw new Error(
    "[ephemeris] calculateHouses(system, JD, city) est désactivée — " +
    "getCity() a été retirée. " +
    "Utiliser calculateHousesByCoords(system, JD, lat, lng) à la place."
  );
}

/**
 * Variante coordonnée directe — c'est celle utilisée par `computeChartFromJD`
 * pour éviter de passer par un CITIES[name] muable (sujet aux races).
 */
export function calculateHousesByCoords(
  system: HouseSystem,
  JD: number,
  lat: number,
  lng: number,
): HouseSet {
  const T   = (JD - 2451545) / 36525;
  const ob  = obl(T);
  const RA  = lst(JD, lng);
  const asc = calcASC(RA, lat, ob);
  const mc  = calcMC(RA, ob);

  let cusps: number[];
  switch (system) {
    case "equal":      cusps = equalHouses(asc); break;
    case "whole_sign": cusps = wholeSignHouses(asc); break;
    case "koch":       cusps = kochHouses(RA, lat, ob); break;
    case "placidus":
    default:           cusps = placidusHouses(RA, lat, ob);
  }
  // VERTEX-V1 : le moteur astracore ne calcule pas le Vertex → null.
  return { cusps, asc, mc, vertex: null, system };
}

/** Trouve la maison (1-12) d'une longitude donnée. */
export function houseOfLongitude(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const n = (i + 1) % 12;
    const s = cusps[i]!, e = cusps[n]!;
    if (e < s) {
      if (lon >= s || lon < e) return i + 1;
    } else {
      if (lon >= s && lon < e) return i + 1;
    }
  }
  return 1;
}

// ASTRO-ENGINE-SPLIT-V1 applied
