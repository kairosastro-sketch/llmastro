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
  // HOUSES-DOMIFICATION-FIX-V1 : atan2 rend déjà le bon quadrant (le MC
  // est dans le même quadrant que le RAMC). L'ancien `if (cos t < 0)
  // mc += 180` était une double correction héritée d'une version atan
  // mono-argument : elle inversait MC et IC pour tout RAMC ∈ (90°, 270°),
  // soit la moitié des heures de naissance.
  return n360(Math.atan2(Math.sin(t), Math.cos(t) * Math.cos(e)) * D);
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

  // Longitude écliptique (degrés) du point de l'écliptique d'ascension
  // droite `ra` (degrés). atan2 rend le bon quadrant directement —
  // HOUSES-DOMIFICATION-FIX-V1 : pas de correction ±180° par-dessus
  // (l'ancienne double correction flippait les cuspides dont l'AR
  // tombait dans (90°, 270°), cassant l'ordre zodiacal des maisons).
  function eclOfRA(ra: number): number {
    const r = ra * R;
    return n360(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(ee)) * D);
  }

  // Cuspide intermédiaire Placidus par itération de point fixe sur
  // l'ascension droite : RA = RAMC + offset + k·AD, avec
  //   AD = asin(tan φ · tan δ)  (différence ascensionnelle, δ déduite de
  //   la longitude écliptique du point courant — pas de son AR),
  //   offset = distance méridienne à l'équateur (30/60/120/150°),
  //   k = poids du demi-arc : 1/3 pour les cuspides adjacentes au
  //   méridien (11 et 3), 2/3 pour celles adjacentes à l'horizon (12, 2).
  // L'ancien code utilisait k = f = offset/90 (4/3 et 5/3 pour les
  // maisons 2 et 3 : jusqu'à ~17° d'écart) et AD = atan(sin φ · tan δ).
  // Validé contre Swiss Ephemeris (astro-seek) à ±0,03° — voir
  // tests/houses.test.ts.
  function pCusp(offset: number, k: number): number {
    let ra = n360(RAMC + offset);
    for (let it = 0; it < 50; it++) {
      const lon  = eclOfRA(ra) * R;
      const decl = Math.asin(Math.sin(ee) * Math.sin(lon));
      const x    = Math.tan(ll) * Math.tan(decl);
      // |tan φ · tan δ| ≥ 1 : point circumpolaire, demi-arc Placidus
      // indéfini (au-delà du cercle polaire) → fallback trisection (G8).
      if (Math.abs(x) >= 1) throw new Error("placidus: cuspide circumpolaire");
      const next = n360(RAMC + offset + k * Math.asin(x) * D);
      const step = Math.abs(n360(next - ra + 180) - 180);
      ra = next;
      if (step < 0.0001) break;
    }
    return eclOfRA(ra);
  }

  try {
    c[10] = pCusp(30,  1 / 3);   // maison 11
    c[11] = pCusp(60,  2 / 3);   // maison 12
    c[1]  = pCusp(120, 2 / 3);   // maison 2
    c[2]  = pCusp(150, 1 / 3);   // maison 3
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

  // HOUSES-POLAR-GUARD-V1 (audit R5) : au-delà des cercles polaires, le
  // quadrant MC→Asc peut s'INVERSER (l'Asc passe à l'ouest du méridien) —
  // la trisection anti-NaN ci-dessus produit alors des cuspides finies
  // mais dans le désordre zodiacal (maisons qui se chevauchent). Pratique
  // standard des logiciels : repli en maisons ÉGALES depuis l'Asc ; le
  // vrai MC reste disponible à part (champ `mc`) et flotte dans les
  // maisons IX-XI, comme le veut ce système.
  if (!cuspsInZodiacalOrder(c)) return equalHouses(asc);
  return c;
}

/**
 * Ordre zodiacal valide : chaque arc cuspide→cuspide suivante ∈ (0°, 180°)
 * ET le cycle boucle en UN tour exactement. Le second critère n'est pas
 * redondant : au pôle Sud exact, la trisection produit 12 arcs tous < 180°
 * dont la somme fait 1080° — le cycle enroule le zodiaque trois fois.
 */
function cuspsInZodiacalOrder(c: number[]): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const arc = n360(c[(i + 1) % 12]! - c[i]!);
    if (arc <= 0 || arc >= 180) return false;
    sum += arc;
  }
  return Math.abs(sum - 360) < 1e-6;
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
// HOUSES-DOMIFICATION-FIX-V1 applied
