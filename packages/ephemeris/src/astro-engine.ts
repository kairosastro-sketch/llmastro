// ============================================================
// astro-engine.ts — Moteur AstraCore : assemblage des thèmes
// ------------------------------------------------------------
// Port TypeScript du moteur Astronomy Engine v3
// Source : astracore_4.html (AstraCore, 20 fixes appliqués)
//
// ASTRO-ENGINE-SPLIT-V1 : le moteur est découpé en modules
// (déplacement pur, zéro changement de logique) ; ce fichier reste
// le POINT D'ENTRÉE — il assemble les thèmes et RÉ-EXPORTE toute
// l'API historique (aucun import existant à changer) :
//
//   engine-core.ts   constantes, n360, jd, nutation/obliquité,
//                    Kepler, types de base (PlanetPosition…)
//   vsop.ts          éléments orbitaux, positions hélio 3D,
//                    conversions géocentriques, isRetrograde
//   solar-lunar.ts   Soleil (Meeus ch.25), Lune (Brown), nœud,
//                    latitude lunaire, phase lunaire
//   houses.ts        GMST/LST, ASC/MC, Placidus/Égales/Signe
//                    entier/Koch, houseOfLongitude
//   aspects.ts       tables canoniques + calculateAspects
//   lots.ts          Part de Fortune + 7 Lots hermétiques
//
// Fournit (assemblage) :
//   • allPositions / equatorialPositions (toutes planètes, un JD)
//   • Ayanamsa Lahiri (zodiaque sidéral)
//   • computeChartFromJD / computeChart / computeCurrentSky
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

// ASTROCARTOGRAPHY-V1 : conversion écliptique→équatorial déléguée au
// module pur astrocartography (réutilisé aussi par swiss-engine).
import { eclipticToEquatorial, type EquatorialCoord } from "./astrocartography.js";
// NUMEROLOGY-MODULE-V1 : implémentation unique du chemin de vie.
import { computeLifePath } from "./numerology.js";

import {
  n360,
  obl,
  type ZodiacSystem,
  type HouseSystem,
  type PlanetPosition,
} from "./engine-core.js";
import {
  OUTER_PLANETS,
  helioPos3D,
  helioToGeoLon,
  helioToGeoLonLat,
  isRetrograde,
} from "./vsop.js";
import { sunGeo, moonGeo, lunarNode, moonLat, moonPhase, type MoonPhase } from "./solar-lunar.js";
import {
  calculateHouses,
  calculateHousesByCoords,
  houseOfLongitude,
  type HouseSet,
} from "./houses.js";
import { calculateAspects, type Aspect } from "./aspects.js";
import { partOfFortune, computeHermeticLots, type HermeticLots } from "./lots.js";

// ──────────────────────────────────────────────────────────
// Ré-exports — API historique d'astro-engine (inchangée)
// ──────────────────────────────────────────────────────────
// (nutLon/obl/solveKepler restent internes à engine-core — ils étaient
// privés avant le découpage, la surface publique ne change pas.)
export { n360, jd } from "./engine-core.js";
export type { ZodiacSystem, HouseSystem, CityCoords, PlanetPosition } from "./engine-core.js";
export { isRetrograde } from "./vsop.js";
export { moonPhase } from "./solar-lunar.js";
export type { MoonPhase } from "./solar-lunar.js";
export {
  gmstDeg,
  obliquityDeg,
  calculateHouses,
  calculateHousesByCoords,
  houseOfLongitude,
} from "./houses.js";
export type { HouseSet } from "./houses.js";
export { ASPECT_TYPES, MINOR_ASPECT_TYPES, calculateAspects } from "./aspects.js";
export type { AspectType, Aspect } from "./aspects.js";
export { partOfFortune, computeHermeticLots } from "./lots.js";
export type { HermeticLots } from "./lots.js";

// ──────────────────────────────────────────────────────────
// Helpers temps legacy (dépréciés)
// ──────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────
// Positions de toutes les planètes (géocentriques) pour un JD
// ──────────────────────────────────────────────────────────
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
  // SOUTH-NODE-RETRO-FIX : le nœud lunaire moyen est toujours rétrograde
  // (longitude moyenne décroissante : −1934°/siècle). Les deux nœuds
  // partagent l'axe nodal → même statut, sinon ils s'affichent « Direct ».
  const nn = lunarNode(T);
  pos["northNode"] = {
    key: "northNode",
    longitude: nn,
    signIdx:   Math.floor(nn / 30),
    degree:    nn % 30,
    retrograde: true,
  };
  const sn = n360(nn + 180);
  pos["southNode"] = {
    key: "southNode",
    longitude: sn,
    signIdx:   Math.floor(sn / 30),
    degree:    sn % 30,
    retrograde: true,
  };

  return pos;
}

// ──────────────────────────────────────────────────────────
// ASTROCARTOGRAPHY-V1 — Positions équatoriales (RA/Dec)
// ──────────────────────────────────────────────────────────
/**
 * Corps tracés en astrocartographie : les 10 luminaires/planètes
 * classiques. Pas de nœuds/Lilith/Chiron en V1 (ce sont des points, pas
 * des lignes d'angularité usuelles — extensible plus tard).
 */
export const ACG_BODY_KEYS = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
] as const;

/**
 * ASTROCARTOGRAPHY-TIMELINE-V1 — Corps « lents » tracés sur le curseur de
 * dates de la carte générale. Seuls eux gardent un sens à une date décalée :
 * leur ligne dérive de quelques degrés par mois (lisible), là où une planète
 * rapide balaie la Terre en heures. On y ajoute le Nœud lunaire (moyen), qui
 * recule de ~19°/an — sa dérive est nette et signifiante.
 */
export const ACG_SLOW_BODY_KEYS = [
  "jupiter", "saturn", "uranus", "neptune", "pluto", "northNode",
] as const;

/**
 * Ascension droite + déclinaison (degrés) de chaque corps pour un JD UT,
 * moteur AstraCore. Convertit la position écliptique géocentrique (λ, β)
 * en équatorial via l'obliquité moyenne. β est calculée (latitude lunaire
 * série Meeus, latitude planétaire depuis le vecteur 3D) — jamais supposée
 * nulle, sauf pour le Soleil qui est sur l'écliptique par définition.
 */
export function equatorialPositions(JD: number): Record<string, EquatorialCoord> {
  const T   = (JD - 2451545) / 36525;
  const eps = obl(T);
  const out: Record<string, EquatorialCoord> = {};

  // Soleil : β = 0 (sur l'écliptique)
  out["sun"] = eclipticToEquatorial(sunGeo(T).lon, 0, eps);

  // Lune : latitude écliptique non négligeable (±5,1°)
  out["moon"] = eclipticToEquatorial(moonGeo(T), moonLat(T), eps);

  // Planètes : longitude + latitude géocentriques depuis le vecteur 3D
  const earthH = helioPos3D("earth", T);
  for (const k of ["mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"]) {
    const g = helioToGeoLonLat(helioPos3D(k, T), earthH);
    out[k] = eclipticToEquatorial(g.lon, g.lat, eps);
  }

  // Nœud lunaire (moyen) : point sur l'écliptique, β = 0. Disponible pour le
  // curseur de dates (ACG_SLOW_BODY_KEYS) ; absent du set par défaut, donc
  // sans effet sur la carte natale / la carte « maintenant ».
  out["northNode"] = eclipticToEquatorial(lunarNode(T), 0, eps);

  return out;
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
  /** POINTS-ARABES-V1 : les 7 Lots hermétiques (Paulus Alexandrinus). */
  lots:       HermeticLots;
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

  // 10. POINTS-ARABES-V1 : Lots hermétiques (même sect que la Part de Fortune).
  const lots = computeHermeticLots(houses.asc, planets, !sunAbove, pofLon);

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
    lots,
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

  // 9. Numérologie — NUMEROLOGY-MODULE-V1 : l'ancienne variante locale
  // (somme de TOUS les chiffres d'un coup) divergeait de la méthode
  // canonique pour certaines dates. On délègue au module unique.
  const s = computeLifePath(dateStr);

  // 10. POINTS-ARABES-V1 : Lots hermétiques (même sect que la Part de Fortune).
  const lots = computeHermeticLots(houses.asc, planets, !sunAbove, pofLon);

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
    lots,
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
// ASTRO-ENGINE-SPLIT-V1 applied
