// ============================================================
// astro-engine.ts — Port TypeScript du moteur Astronomy Engine v3
// Source : astracore_4.html (AstraCore, 20 fixes appliqués)
//
// Fournit :
//   • Calcul JD timezone-aware (DST auto pour l'Europe)
//   • Longitudes géocentriques des 10 planètes + Chiron + Nœud lunaire
//     via Meeus/Brown (Soleil + Lune) et VSOP simplifié (planètes)
//   • Maisons Placidus itératives + Équales + Signe entier + Koch
//   • Aspects majeurs avec orbes variables
//   • Ayanamsa Lahiri (zodiaque sidéral)
//   • Phase lunaire, détection rétrograde, Part de Fortune
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────
const PI = Math.PI;
const R  = PI / 180;   // deg → rad
const D  = 180 / PI;   // rad → deg

export type ZodiacSystem = "tropical" | "sidereal";
export type HouseSystem  = "placidus" | "equal" | "whole_sign" | "koch";

export interface CityCoords { lat: number; lng: number; tz: number; }

// EPHEMERIS-DEEP-CONSOLIDATION-V1 : suppression de l'objet CITIES
// (148 villes hardcodées) et de getCity() qui throw. Code mort
// confirmé : aucun appelant externe au package, déjà neutralisé.
// Le type CityCoords (utilisé en interne par les fonctions de
// calcul des maisons, lignes 600+) reste exporté.

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

// ──────────────────────────────────────────────────────────
// Types d'aspects
// ──────────────────────────────────────────────────────────
export interface AspectType {
  type:  "conjunction" | "sextile" | "square" | "trine" | "opposition" | "quincunx";
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

/**
 * @deprecated L'ancien DST "dernier dimanche de mars/octobre" ne couvrait
 *   ni les règles historiques, ni hors Europe occidentale, ni les heures
 *   ambiguës/inexistantes. Voir `time-utc.service.ts::localToUTC`.
 *
 * On conserve la fonction pour compat des tests legacy mais elle ne doit
 * plus être appelée depuis le flux natal réel.
 */
export function isDST(y: number, m: number, d: number, baseTz: number): boolean {
  if (baseTz < -2 || baseTz > 3) return false;
  const mar = new Date(y, 2, 31);
  while (mar.getDay() !== 0) mar.setDate(mar.getDate() - 1);
  const oct = new Date(y, 9, 31);
  while (oct.getDay() !== 0) oct.setDate(oct.getDate() - 1);
  const dt = new Date(y, m - 1, d);
  return dt >= mar && dt < oct;
}

/**
 * @deprecated Utiliser `localToUTC(date, time, ianaTz).jdUT` depuis
 *   `time-utc.service.ts`. Cette version maison :
 *     - mélange convention UTC et locale selon le `tz` passé
 *     - ne gère pas les heures ambiguës/inexistantes
 *     - ne couvre pas les règles historiques
 *   Elle ne doit plus être appelée par le service natal.
 */
export function jdFromLocal(
  _dateStr: string,
  _timeStr: string,
  _city: string,
): number {
  // CI-DEBT-PURGE-V1-C: getCity() retiré par EPHEMERIS-DEEP-CONSOLIDATION-V1.
  // Cette fonction est inutilisable. Migrer vers la nouvelle API :
  //   localToUTC(date, time, ianaTz).jdUT  →  computeChartFromJD(jd, lat, lng)
  throw new Error(
    "[ephemeris] jdFromLocal() est désactivée — getCity() a été retirée " +
    "par EPHEMERIS-DEEP-CONSOLIDATION-V1. " +
    "Utiliser localToUTC() depuis time-utc.service.ts puis " +
    "computeChartFromJD() pour calculer un thème."
  );
}

/** Nutation en longitude (degrés). */
function nutLon(T: number): number {
  const O  = (125.04  - 1934.136 * T) * R;
  const L  = (280.4665 + 36000.7698 * T) * R;
  const Lp = (218.3165 + 481267.8813 * T) * R;
  return (-17.2 * Math.sin(O)
          -  1.32 * Math.sin(2 * L)
          -  0.23 * Math.sin(2 * Lp)
          +  0.21 * Math.sin(2 * O)) / 3600;
}

/** Obliquité moyenne de l'écliptique (degrés). */
function obl(T: number): number {
  return 23.439291 - 0.013004 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
}

/** Kepler itératif (Newton). */
function solveKepler(Mdeg: number, e: number): number {
  const M = Mdeg * R;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 200; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// ──────────────────────────────────────────────────────────
// Longitudes géocentriques Soleil + Lune
// ──────────────────────────────────────────────────────────
interface SunGeo { lon: number; r: number; }

/** Soleil : Meeus ch.25 avec excentricité variable + nutation. */
function sunGeo(T: number): SunGeo {
  const L0 = n360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M  = n360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = M * R;
  const e  = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
           + (0.019993 - 0.000101 * T)                  * Math.sin(2 * Mr)
           +  0.000289                                    * Math.sin(3 * Mr);
  const lon = n360(L0 + C + nutLon(T) - 0.005694);       // aberration
  const r   = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(Mr + C * R));
  return { lon, r };
}

/** Lune : série principale de Brown (précision ~0.3°). */
function moonGeo(T: number): number {
  const Lp = n360(218.3165 + 481267.8813 * T + nutLon(T));
  const D  = (297.8502 + 445267.1115 * T) * R;
  const M  = (357.5291 +  35999.0503 * T) * R;
  const Mp = (134.9634 + 477198.8676 * T) * R;
  const F  = ( 93.272  + 483202.0175 * T) * R;
  return n360(
      Lp
    + 6.289 * Math.sin(Mp)
    + 1.274 * Math.sin(2 * D - Mp)
    + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mp)
    - 0.186 * Math.sin(M)
    - 0.114 * Math.sin(2 * F)
    + 0.059 * Math.sin(2 * D - 2 * Mp)
    + 0.057 * Math.sin(2 * D - M - Mp)
    + 0.053 * Math.sin(2 * D + Mp)
    + 0.046 * Math.sin(2 * D - M)
    - 0.041 * Math.sin(M - Mp)
    - 0.035 * Math.sin(D)
    - 0.030 * Math.sin(M + Mp)
    + 0.015 * Math.sin(2 * D - 2 * F)
  );
}

/** Nœud lunaire moyen. */
function lunarNode(T: number): number {
  return n360(125.0446 - 1934.1363 * T + 0.0021 * T * T);
}

// ──────────────────────────────────────────────────────────
// Position héliocentrique 3D d'une planète
// ──────────────────────────────────────────────────────────
interface Pos3D { x: number; y: number; z: number; lon: number; r: number; }

function helioPos3D(key: string, T: number): Pos3D {
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
function helioToGeoLon(p: Pos3D, e: Pos3D): number {
  const xg = p.x - e.x;
  const yg = p.y - e.y;
  return n360(Math.atan2(yg, xg) * D);
}

// ──────────────────────────────────────────────────────────
// Positions de toutes les planètes (géocentriques) pour un JD
// ──────────────────────────────────────────────────────────
export interface PlanetPosition {
  key:       string;
  longitude: number;   // 0-360 écliptique
  signIdx:   number;   // 0-11
  degree:    number;   // 0-30 dans le signe
  retrograde?: boolean;
  house?:     number;
}

// LILITH-V1 : Lilith (Mean Apogee) n'est PAS calculée par astro-engine
// (mode Meeus/VSOP, sans data files). Elle n'apparaît dans les positions
// que quand ASTRO_ENGINE=swisseph est actif. Le code consommateur doit
// gérer l'absence (Object.entries(planets) itère naturellement sur ce qui
// est présent — pas de crash, juste pas d'affichage).
const OUTER_PLANETS = ["mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","chiron"] as const;

export function allPositions(JD: number): Record<string, PlanetPosition> {
  const T = (JD - 2451545) / 36525;
  const pos: Record<string, PlanetPosition> = {};

  // Soleil
  const sun = sunGeo(T);
  pos["sun"] = {
    key: "sun",
    longitude: sun.lon,
    signIdx:   Math.floor(sun.lon / 30),
    degree:    sun.lon % 30,
  };

  // Lune
  const ml = moonGeo(T);
  pos["moon"] = {
    key: "moon",
    longitude: ml,
    signIdx:   Math.floor(ml / 30),
    degree:    ml % 30,
  };

  // Planètes
  const earthH = helioPos3D("earth", T);
  OUTER_PLANETS.forEach(k => {
    const pH = helioPos3D(k, T);
    const lon = helioToGeoLon(pH, earthH);
    pos[k] = {
      key: k,
      longitude: lon,
      signIdx:   Math.floor(lon / 30),
      degree:    lon % 30,
    };
  });

  // Nœud lunaire Nord + Sud
  const nn = lunarNode(T);
  pos["northNode"] = {
    key: "northNode",
    longitude: nn,
    signIdx:   Math.floor(nn / 30),
    degree:    nn % 30,
  };
  const sn = n360(nn + 180);
  pos["southNode"] = {
    key: "southNode",
    longitude: sn,
    signIdx:   Math.floor(sn / 30),
    degree:    sn % 30,
  };

  return pos;
}

// ──────────────────────────────────────────────────────────
// Ayanamsa Lahiri (pour zodiaque sidéral)
// ──────────────────────────────────────────────────────────
export function ayanamsa(JD: number): number {
  const T = (JD - 2451545) / 36525;
  const y = 2000 + T * 100;
  return 22.460 + 1.3748 * (y - 1900) / 100 - 0.000572 * (y - 1900) * (y - 1900) / 1e6;
}

export function toSidereal(lon: number, JD: number): number {
  return n360(lon - ayanamsa(JD));
}

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
  const skip = new Set(["northNode", "southNode", "fortune"]);
  const keys = Object.keys(pos).filter(k => !skip.has(k));
  const out: Aspect[] = [];

  for (let i = 0; i < keys.length - 1; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const k1 = keys[i]!, k2 = keys[j]!;
      let d = Math.abs(pos[k1]!.longitude - pos[k2]!.longitude);
      if (d > 180) d = 360 - d;

      for (const a of ASPECT_TYPES) {
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

// ──────────────────────────────────────────────────────────
// Phase lunaire
// ──────────────────────────────────────────────────────────
export interface MoonPhase {
  phase:       string;
  emoji:       string;
  illumination: number;
  description: string;
  key: string;
}

const MOON_PHASES_FR: Record<string, { phase: string; description: string }> = {
  moon_new:     { phase: "Nouvelle Lune",      description: "Temps des semences et des intentions nouvelles" },
  moon_waxc:    { phase: "Premier croissant",  description: "Croissance, construction, prise d'élan" },
  moon_firstq:  { phase: "Premier quartier",   description: "Décisions, action, dépassement des obstacles" },
  moon_waxg:    { phase: "Gibbeuse croissante", description: "Perfectionnement, ajustements, persévérance" },
  moon_full:    { phase: "Pleine Lune",        description: "Culmination, révélation, intensité émotionnelle" },
  moon_wang:    { phase: "Gibbeuse décroissante", description: "Gratitude, partage, diffusion" },
  moon_lastq:   { phase: "Dernier quartier",   description: "Lâcher-prise, révisions, ajustements" },
  moon_wanc:    { phase: "Dernier croissant",  description: "Repos, introspection, purification" },
};

export function moonPhase(JD: number): MoonPhase {
  const T  = (JD - 2451545) / 36525;
  const sl = sunGeo(T).lon;
  const ml = moonGeo(T);
  const el = n360(ml - sl);

  let k: string, emoji: string;
  if      (el <  11.25) { k = "moon_new";    emoji = "🌑"; }
  else if (el <  78.75) { k = "moon_waxc";   emoji = "🌒"; }
  else if (el < 101.25) { k = "moon_firstq"; emoji = "🌓"; }
  else if (el < 168.75) { k = "moon_waxg";   emoji = "🌔"; }
  else if (el < 191.25) { k = "moon_full";   emoji = "🌕"; }
  else if (el < 258.75) { k = "moon_wang";   emoji = "🌖"; }
  else if (el < 281.25) { k = "moon_lastq";  emoji = "🌗"; }
  else if (el < 348.75) { k = "moon_wanc";   emoji = "🌘"; }
  else                  { k = "moon_new";    emoji = "🌑"; }

  const info = MOON_PHASES_FR[k]!;
  // illumination approximative : (1 - cos(el)) / 2
  const illumination = (1 - Math.cos(el * R)) / 2;

  return {
    key: k,
    phase: info.phase,
    emoji,
    illumination: Math.round(illumination * 100) / 100,
    description: info.description,
  };
}

// ──────────────────────────────────────────────────────────
// Part de Fortune
// ──────────────────────────────────────────────────────────
export function partOfFortune(sunLon: number, moonLon: number, asc: number, isNight: boolean): number {
  return isNight
    ? n360(asc + sunLon  - moonLon)
    : n360(asc + moonLon - sunLon);
}

// ──────────────────────────────────────────────────────────
// CALCUL COMPLET D'UN THÈME
// ──────────────────────────────────────────────────────────
export interface ChartResult {
  planets:    Record<string, PlanetPosition>;
  houses:     HouseSet;
  aspects:    Aspect[];
  retrogrades: string[];
  moonPhase:  MoonPhase;
  numerology: number;
  zodiac:     ZodiacSystem;
  houseSystem: HouseSystem;
  JD:         number;
  T:          number;
  ayanamsa:   number;
  /** C2-FIX : moteur réel ayant produit le thème ("meeus" = AstraCore). */
  source:     "meeus" | "swiss";
}

export interface ChartOptions {
  zodiac?:      ZodiacSystem;
  houseSystem?: HouseSystem;
}

/**
 * Calcule un thème à partir d'un JD UT + coordonnées directes.
 *
 * Entrée canonique recommandée par le nouveau `service.ts`. Évite :
 *   - le lookup `CITIES[name]`
 *   - toute conversion timezone implicite (le JD UT est déjà UTC)
 *   - la pollution temporaire de la map CITIES (sujet aux races)
 */
export function computeChartFromJD(
  JD: number,
  latitude: number,
  longitude: number,
  opts: ChartOptions = {},
): ChartResult {
  const zodiac      = opts.zodiac      ?? "tropical";
  const houseSystem = opts.houseSystem ?? "placidus";

  const T = (JD - 2451545) / 36525;

  // 1. Positions géocentriques
  let planets = allPositions(JD);

  // 2. Ajustement sidéral si demandé
  if (zodiac === "sidereal") {
    const adjusted: Record<string, PlanetPosition> = {};
    for (const k of Object.keys(planets)) {
      const slon = toSidereal(planets[k]!.longitude, JD);
      adjusted[k] = {
        ...planets[k]!,
        longitude: slon,
        signIdx: Math.floor(slon / 30),
        degree:  slon % 30,
      };
    }
    planets = adjusted;
  }

  // 3. Maisons — version coord-directe (pas de lookup CITIES)
  const houses = calculateHousesByCoords(houseSystem, JD, latitude, longitude);
  if (zodiac === "sidereal") {
    houses.cusps = houses.cusps.map(c => toSidereal(c, JD));
    houses.asc   = toSidereal(houses.asc, JD);
    houses.mc    = toSidereal(houses.mc,  JD);
  }

  // 4. Assigner la maison à chaque planète
  for (const k of Object.keys(planets)) {
    planets[k]!.house = houseOfLongitude(planets[k]!.longitude, houses.cusps);
  }

  // 5. Rétrogrades
  const retrogrades: string[] = [];
  (["mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"] as const).forEach(k => {
    const r = isRetrograde(k, JD);
    if (planets[k]) planets[k]!.retrograde = r;
    if (r) retrogrades.push(k);
  });

  // 6. Aspects
  const aspects = calculateAspects(planets);

  // 7. Part de Fortune
  const sunLon  = planets["sun"]!.longitude;
  const moonLon = planets["moon"]!.longitude;
  const sunAbove = ((sunLon - houses.asc + 360) % 360) >= 180; // B1-FIX : ≥180° = maisons 7-12 = au-dessus de l'horizon (thème de jour)
  const pofLon = partOfFortune(sunLon, moonLon, houses.asc, !sunAbove);
  planets["fortune"] = {
    key: "fortune",
    longitude: pofLon,
    signIdx:   Math.floor(pofLon / 30),
    degree:    pofLon % 30,
    house:     houseOfLongitude(pofLon, houses.cusps),
  };

  // 8. Phase lunaire
  const phase = moonPhase(JD);

  // 9. Numérologie — note : le path de vie dépend de la date LOCALE
  //    pas de la date UTC. Le service.ts dérive la numérologie depuis
  //    `localBirthDate` et la pose via meta, on laisse 0 ici.
  const numerology = 0;

  return {
    planets,
    houses,
    aspects,
    retrogrades,
    moonPhase: phase,
    numerology,
    zodiac,
    houseSystem,
    JD, T,
    ayanamsa: zodiac === "sidereal" ? ayanamsa(JD) : 0,
    source: "meeus",
  };
}

/**
 * Calcule un thème natal complet.
 *
 * @deprecated Utiliser `computeChartFromJD(jdUT, lat, lng, opts)` depuis
 *   `service.ts`. Cette surcharge a une convention temps implicite
 *   (via `jdFromLocal` → DST maison) qui n'est plus recommandée.
 *
 * @param dateStr "YYYY-MM-DD" (date locale de naissance)
 * @param timeStr "HH:MM" (heure locale de naissance)
 * @param city    nom de la ville (doit être dans CITIES)
 * @param opts    { zodiac, houseSystem }
 */
export function computeChart(
  dateStr: string,
  timeStr: string,
  city:    string,
  opts:    ChartOptions = {},
): ChartResult {
  const zodiac      = opts.zodiac      ?? "tropical";
  const houseSystem = opts.houseSystem ?? "placidus";

  const JD = jdFromLocal(dateStr, timeStr, city);
  const T  = (JD - 2451545) / 36525;

  // 1. Positions géocentriques
  let planets = allPositions(JD);

  // 2. Ajustement sidéral si demandé
  if (zodiac === "sidereal") {
    const adjusted: Record<string, PlanetPosition> = {};
    for (const k of Object.keys(planets)) {
      const slon = toSidereal(planets[k]!.longitude, JD);
      adjusted[k] = {
        ...planets[k]!,
        longitude: slon,
        signIdx: Math.floor(slon / 30),
        degree:  slon % 30,
      };
    }
    planets = adjusted;
  }

  // 3. Maisons
  const houses = calculateHouses(houseSystem, JD, city);
  if (zodiac === "sidereal") {
    houses.cusps = houses.cusps.map(c => toSidereal(c, JD));
    houses.asc   = toSidereal(houses.asc, JD);
    houses.mc    = toSidereal(houses.mc,  JD);
  }

  // 4. Assigner la maison à chaque planète
  for (const k of Object.keys(planets)) {
    planets[k]!.house = houseOfLongitude(planets[k]!.longitude, houses.cusps);
  }

  // 5. Rétrogrades
  const retrogrades: string[] = [];
  (["mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"] as const).forEach(k => {
    const r = isRetrograde(k, JD);
    if (planets[k]) planets[k]!.retrograde = r;
    if (r) retrogrades.push(k);
  });

  // 6. Aspects
  const aspects = calculateAspects(planets);

  // 7. Part de Fortune
  const sunLon  = planets["sun"]!.longitude;
  const moonLon = planets["moon"]!.longitude;
  const sunAbove = ((sunLon - houses.asc + 360) % 360) >= 180; // B1-FIX : ≥180° = maisons 7-12 = au-dessus de l'horizon (thème de jour)
  const pofLon = partOfFortune(sunLon, moonLon, houses.asc, !sunAbove);
  planets["fortune"] = {
    key: "fortune",
    longitude: pofLon,
    signIdx:   Math.floor(pofLon / 30),
    degree:    pofLon % 30,
    house:     houseOfLongitude(pofLon, houses.cusps),
  };

  // 8. Phase lunaire
  const phase = moonPhase(JD);

  // 9. Numérologie — Chemin de vie depuis la date
  const digits = dateStr.replace(/-/g, "").split("").map(Number);
  let s = digits.reduce((a, b) => a + b, 0);
  while (s > 9 && s !== 11 && s !== 22 && s !== 33) {
    s = String(s).split("").map(Number).reduce((a, b) => a + b, 0);
  }

  return {
    planets,
    houses,
    aspects,
    retrogrades,
    moonPhase: phase,
    numerology: s,
    zodiac,
    houseSystem,
    JD, T,
    ayanamsa: zodiac === "sidereal" ? ayanamsa(JD) : 0,
    source: "meeus",
  };
}

/**
 * Calcule le thème du moment présent (transits).
 *
 * Version corrigée : on utilise `computeChartFromJD` avec un JD UT
 * calculé depuis l'instant système, sans mutation globale de CITIES.
 */
export function computeCurrentSky(
  lat:  number,
  lng:  number,
  opts: ChartOptions = {},
): ChartResult {
  // JD UT depuis l'instant système (Date.now est millis UTC).
  const JD = Date.now() / 86400000 + 2440587.5;
  return computeChartFromJD(JD, lat, lng, opts);
}

// EPHEMERIS-DEEP-CONSOLIDATION-V1 applied
// CI-DEBT-PURGE-V1-C applied
