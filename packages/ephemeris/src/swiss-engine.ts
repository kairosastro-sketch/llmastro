// ============================================================
// swiss-engine.ts — Moteur de calcul via Swiss Ephemeris
// ------------------------------------------------------------
// ARCHIVE-EPHEMERIDES-SWISSEPH-V1
//
// Implémente la même interface publique que astro-engine pour les
// fonctions de calcul lourd (computeChartFromJD, computeCurrentSky,
// allPositionsSwiss, calculateHousesSwiss).
//
// Mode Moshier (SEFLG_MOSEPH) :
//   - Précision ~1 arcseconde, plage -3000 à +3000.
//   - Aucun fichier ephemeris (.se1) requis sur disque.
//   - Couvre Soleil, Lune, Mercure→Pluton, nœuds (vrai et moyen),
//     Lilith moyenne. Chiron/asteroïdes nécessitent les fichiers
//     d'éphémérides (phase B via JPL Horizons).
//
// Les helpers calcul-pur (calculateAspects, partOfFortune,
// houseOfLongitude, toSidereal, ayanamsa, n360) sont réutilisés
// depuis astro-engine puisqu'ils ne dépendent pas du moteur.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import {
  type ZodiacSystem,
  type HouseSystem,
  type PlanetPosition,
  type HouseSet,
  type ChartResult,
  type ChartOptions,
  calculateAspects,
  moonPhase,
  partOfFortune,
  houseOfLongitude,
  toSidereal,
  ayanamsa,
  n360,
} from "./astro-engine.js";

// ──────────────────────────────────────────────────────────
// Chargement lazy de swisseph (optional dependency)
// ──────────────────────────────────────────────────────────

let _swe: any = null;            // null = pas tenté ; false = échec ; objet = OK
let _swissephLoadError: string | null = null;

// require global Node — disponible en CJS (build tsup prod).
// En ESM strict, undefined → loadSwisseph échouera gracieusement et le
// router retombera sur AstraCore.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: ((id: string) => any) | undefined;

function loadSwisseph(): boolean {
  if (_swe !== null) return _swe !== false;
  try {
    if (typeof require !== "function") {
      throw new Error("require() not available (ESM context?) — swisseph cannot be loaded");
    }
    _swe = require("swisseph");
    // Configurer le path des fichiers d'éphémérides (utile plus tard
    // pour Chiron/asteroïdes ou licence pro). En mode Moshier seul,
    // ce path n'est pas lu.
    const path = process.env["SWISSEPH_PATH"] ?? "/usr/local/share/swisseph";
    if (typeof _swe.swe_set_ephe_path === "function") {
      try { _swe.swe_set_ephe_path(path); } catch { /* tolérant */ }
    }
    return true;
  } catch (err) {
    _swe = false;
    _swissephLoadError = err instanceof Error ? err.message : String(err);
    return false;
  }
}

export function isSwissephLoaded(): boolean {
  return _swe !== null && _swe !== false;
}

export function getSwissephLoadError(): string | null {
  return _swissephLoadError;
}

/**
 * Force le chargement (utile pour le health-check admin).
 * Retourne true si la lib est disponible, false sinon.
 */
export function ensureSwissephLoaded(): boolean {
  return loadSwisseph();
}

// ──────────────────────────────────────────────────────────
// Mappings constantes (initialisés après le 1er load)
// ──────────────────────────────────────────────────────────

interface PlanetIplMap {
  sun: number; moon: number; mercury: number; venus: number;
  mars: number; jupiter: number; saturn: number; uranus: number;
  neptune: number; pluto: number; northNode: number;
}

let _PLANET_IPL: PlanetIplMap | null = null;

function getPlanetIpl(): PlanetIplMap {
  if (_PLANET_IPL) return _PLANET_IPL;
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  _PLANET_IPL = {
    sun:       _swe.SE_SUN,
    moon:      _swe.SE_MOON,
    mercury:   _swe.SE_MERCURY,
    venus:     _swe.SE_VENUS,
    mars:      _swe.SE_MARS,
    jupiter:   _swe.SE_JUPITER,
    saturn:    _swe.SE_SATURN,
    uranus:    _swe.SE_URANUS,
    neptune:   _swe.SE_NEPTUNE,
    pluto:     _swe.SE_PLUTO,
    // Nœud lunaire moyen (cohérent avec astro-engine actuel).
    // Pour passer en nœud vrai : SE_TRUE_NODE.
    northNode: _swe.SE_MEAN_NODE,
  };
  return _PLANET_IPL;
}

const HOUSE_SYSTEM_CHAR: Record<HouseSystem, string> = {
  placidus:   "P",
  koch:       "K",
  equal:      "E",
  whole_sign: "W",
};

// ──────────────────────────────────────────────────────────
// Calcul des positions planétaires
// ──────────────────────────────────────────────────────────

/**
 * Toutes les positions géocentriques pour un JD UT donné.
 * Mode Moshier (pas de fichier disque requis).
 */
export function allPositionsSwiss(JD: number): Record<string, PlanetPosition> {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const flag = _swe.SEFLG_MOSEPH | _swe.SEFLG_SPEED;
  const ipl  = getPlanetIpl();
  const out: Record<string, PlanetPosition> = {};

  for (const [key, code] of Object.entries(ipl)) {
    const r = _swe.swe_calc_ut(JD, code, flag);
    if (r && typeof r === "object" && "error" in r && r.error) {
      throw new Error(`swe_calc_ut failed for ${key} (ipl=${code}): ${r.error}`);
    }
    const lon = n360(r.longitude);
    out[key] = {
      key,
      longitude: lon,
      signIdx:   Math.floor(lon / 30),
      degree:    lon % 30,
      retrograde: typeof r.longitudeSpeed === "number" ? r.longitudeSpeed < 0 : false,
    };
  }

  // Nœud sud = nord + 180
  if (out["northNode"]) {
    const sn = n360(out["northNode"].longitude + 180);
    out["southNode"] = {
      key: "southNode",
      longitude: sn,
      signIdx:   Math.floor(sn / 30),
      degree:    sn % 30,
    };
  }

  return out;
}

// ──────────────────────────────────────────────────────────
// Calcul des maisons
// ──────────────────────────────────────────────────────────

export function calculateHousesSwiss(
  system: HouseSystem,
  JD: number,
  lat: number,
  lng: number,
): HouseSet {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const hsys = HOUSE_SYSTEM_CHAR[system] ?? "P";
  const r = _swe.swe_houses(JD, lat, lng, hsys);
  if (r && typeof r === "object" && "error" in r && r.error) {
    throw new Error(`swe_houses failed: ${r.error}`);
  }
  // r.house est un tableau de 12 cusps (1..12)
  // r.ascendant et r.mc sont scalaires
  const cusps: number[] = (r.house as number[]).map(n360);
  return {
    cusps,
    asc:  n360(r.ascendant),
    mc:   n360(r.mc),
    system,
  };
}

// ──────────────────────────────────────────────────────────
// Phase lunaire — variante depuis longitudes pré-calculées
// ──────────────────────────────────────────────────────────
// On garde la même logique de bornes/phases que astro-engine.moonPhase
// mais en partant des longitudes Swisseph (plus précises) plutôt que
// de recalculer Soleil/Lune via Meeus.

function moonPhaseFromLongitudes(sunLon: number, moonLon: number): ReturnType<typeof moonPhase> {
  const el = n360(moonLon - sunLon);

  let key: string, emoji: string;
  if      (el <  11.25) { key = "moon_new";    emoji = "🌑"; }
  else if (el <  78.75) { key = "moon_waxc";   emoji = "🌒"; }
  else if (el < 101.25) { key = "moon_firstq"; emoji = "🌓"; }
  else if (el < 168.75) { key = "moon_waxg";   emoji = "🌔"; }
  else if (el < 191.25) { key = "moon_full";   emoji = "🌕"; }
  else if (el < 258.75) { key = "moon_wang";   emoji = "🌖"; }
  else if (el < 281.25) { key = "moon_lastq";  emoji = "🌗"; }
  else if (el < 348.75) { key = "moon_wanc";   emoji = "🌘"; }
  else                  { key = "moon_new";    emoji = "🌑"; }

  // Description FR (mêmes textes que astro-engine, dupliqués pour ne pas
  // exporter MOON_PHASES_FR)
  const FR: Record<string, { phase: string; description: string }> = {
    moon_new:    { phase: "Nouvelle Lune",          description: "Temps des semences et des intentions nouvelles" },
    moon_waxc:   { phase: "Premier croissant",      description: "Croissance, construction, prise d'élan" },
    moon_firstq: { phase: "Premier quartier",       description: "Décisions, action, dépassement des obstacles" },
    moon_waxg:   { phase: "Gibbeuse croissante",    description: "Perfectionnement, ajustements, persévérance" },
    moon_full:   { phase: "Pleine Lune",            description: "Culmination, révélation, intensité émotionnelle" },
    moon_wang:   { phase: "Gibbeuse décroissante",  description: "Gratitude, partage, diffusion" },
    moon_lastq:  { phase: "Dernier quartier",       description: "Lâcher-prise, révisions, ajustements" },
    moon_wanc:   { phase: "Dernier croissant",      description: "Repos, introspection, purification" },
  };
  const info = FR[key]!;
  const illumination = (1 - Math.cos((el * Math.PI) / 180)) / 2;

  return {
    key,
    phase: info.phase,
    emoji,
    illumination: Math.round(illumination * 100) / 100,
    description: info.description,
  };
}

// ──────────────────────────────────────────────────────────
// Compute chart depuis un JD UT — entrée canonique
// ──────────────────────────────────────────────────────────

export function computeChartFromJDSwiss(
  JD: number,
  latitude: number,
  longitude: number,
  opts: ChartOptions = {},
): ChartResult {
  const zodiac      = opts.zodiac      ?? "tropical";
  const houseSystem = opts.houseSystem ?? "placidus";
  const T = (JD - 2451545) / 36525;

  // 1. Positions géocentriques
  let planets = allPositionsSwiss(JD);

  // 2. Sidéral si demandé
  if (zodiac === "sidereal") {
    const adjusted: Record<string, PlanetPosition> = {};
    for (const k of Object.keys(planets)) {
      const slon = toSidereal(planets[k]!.longitude, JD);
      adjusted[k] = {
        ...planets[k]!,
        longitude: slon,
        signIdx:   Math.floor(slon / 30),
        degree:    slon % 30,
      };
    }
    planets = adjusted;
  }

  // 3. Maisons
  const houses = calculateHousesSwiss(houseSystem, JD, latitude, longitude);
  if (zodiac === "sidereal") {
    houses.cusps = houses.cusps.map(c => toSidereal(c, JD));
    houses.asc   = toSidereal(houses.asc, JD);
    houses.mc    = toSidereal(houses.mc,  JD);
  }

  // 4. Maison de chaque planète
  for (const k of Object.keys(planets)) {
    planets[k]!.house = houseOfLongitude(planets[k]!.longitude, houses.cusps);
  }

  // 5. Rétrogrades — déjà dans planets[k].retrograde via SEFLG_SPEED
  const retrogrades: string[] = [];
  for (const k of ["mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"]) {
    if (planets[k]?.retrograde) retrogrades.push(k);
  }

  // 6. Aspects
  const aspects = calculateAspects(planets);

  // 7. Part de Fortune
  const sunLon  = planets["sun"]!.longitude;
  const moonLon = planets["moon"]!.longitude;
  const sunAbove = ((sunLon - houses.asc + 360) % 360) < 180;
  const pofLon = partOfFortune(sunLon, moonLon, houses.asc, !sunAbove);
  planets["fortune"] = {
    key: "fortune",
    longitude: pofLon,
    signIdx:   Math.floor(pofLon / 30),
    degree:    pofLon % 30,
    house:     houseOfLongitude(pofLon, houses.cusps),
  };

  // 8. Phase lunaire à partir des longitudes Swisseph
  const phase = moonPhaseFromLongitudes(sunLon, moonLon);
  void moonPhase; // import gardé pour éviter dead-code warning si on revient à l'ancien

  return {
    planets,
    houses,
    aspects,
    retrogrades,
    moonPhase: phase,
    numerology: 0,           // dérivée plus tard à partir de localBirthDate
    zodiac,
    houseSystem,
    JD, T,
    ayanamsa: zodiac === "sidereal" ? ayanamsa(JD) : 0,
    // `source` reste typée "meeus" dans astro-engine ; on respecte le type
    // littéral pour ne pas casser l'API. Le moteur réel est tracé via
    // l'env ASTRO_ENGINE et le health-check admin.
    source: "meeus",
  };
}

/**
 * Ciel du moment présent (transits) via Swisseph.
 */
export function computeCurrentSkySwiss(
  lat: number,
  lng: number,
  opts: ChartOptions = {},
): ChartResult {
  const JD = Date.now() / 86400000 + 2440587.5;
  return computeChartFromJDSwiss(JD, lat, lng, opts);
}

/**
 * Helper standalone : calcul de la longitude d'un corps unique.
 * Utilisé par le health-check pour vérifier que swisseph répond.
 */
export function getPlanetLongitudeSwiss(JD: number, planetKey: keyof PlanetIplMap): number {
  if (!loadSwisseph()) throw new Error("swisseph not loaded");
  const ipl = getPlanetIpl();
  const code = ipl[planetKey];
  const r = _swe.swe_calc_ut(JD, code, _swe.SEFLG_MOSEPH);
  if (r && typeof r === "object" && "error" in r && r.error) {
    throw new Error(`swe_calc_ut failed: ${r.error}`);
  }
  return n360(r.longitude);
}

// ============================================================
// ECLIPSE-MAGNITUDE-V1
// ------------------------------------------------------------
// Magnitude précise des éclipses via Swiss Ephemeris :
//   • swe_sol_eclipse_where : retourne magnitude + obscuration + saros
//     au point central d'une éclipse solaire à la date donnée
//   • swe_lun_eclipse_how   : retourne umbral/penumbral magnitude
//     d'une éclipse lunaire (la magnitude est globale, on passe des
//     coords nulles — la valeur reste cohérente)
//
// Retournent null si swisseph n'est pas chargé OU si le binding rend
// une erreur (date hors-éclipse, etc.). Le caller doit fallback sur
// la classification qualitative existante en cas de null.
// ============================================================

export type SolarEclipseKind = "total" | "annular" | "partial" | "hybrid";
export type LunarEclipseKind = "total" | "partial" | "penumbral";

export interface SolarEclipseDetails {
  magnitude:        number;             // 0..1.0+ (>1 = totale, ratio diamètres)
  obscuration:      number;             // 0..1 (fraction du disque solaire couverte)
  kind:             SolarEclipseKind;
  saros:            number;             // numéro de série Saros
  sarosMember:      number;             // rang dans la série
}

export interface LunarEclipseDetails {
  magnitude:        number;             // umbralMagnitude (>1 = totale)
  penumbralMagnitude: number;
  kind:             LunarEclipseKind;
  saros:            number;
  sarosMember:      number;
}

function decodeSolarRflag(rflag: number, swe: any): SolarEclipseKind {
  // Bit-flags Swiss Ephemeris : SE_ECL_TOTAL=1, SE_ECL_ANNULAR=2,
  // SE_ECL_PARTIAL=4, SE_ECL_ANNULAR_TOTAL=8 (hybrid).
  if (rflag & (swe.SE_ECL_ANNULAR_TOTAL ?? 8)) return "hybrid";
  if (rflag & (swe.SE_ECL_TOTAL          ?? 1)) return "total";
  if (rflag & (swe.SE_ECL_ANNULAR        ?? 2)) return "annular";
  return "partial";
}

function decodeLunarRflag(rflag: number, swe: any): LunarEclipseKind {
  // SE_ECL_PENUMBRAL = 16. SE_ECL_TOTAL=1, SE_ECL_PARTIAL=4 (lunaire).
  if (rflag & (swe.SE_ECL_TOTAL     ?? 1))  return "total";
  if (rflag & (swe.SE_ECL_PARTIAL   ?? 4))  return "partial";
  if (rflag & (swe.SE_ECL_PENUMBRAL ?? 16)) return "penumbral";
  return "penumbral";
}

export function computeSolarEclipseDetailsSwiss(JD: number): SolarEclipseDetails | null {
  if (!loadSwisseph()) return null;
  try {
    const r = _swe.swe_sol_eclipse_where(JD, _swe.SEFLG_SWIEPH);
    if (!r || "error" in r) return null;
    return {
      magnitude:   r.eclipseMagnitude,
      obscuration: r.solarDiscFraction,
      kind:        decodeSolarRflag(r.rflag, _swe),
      saros:       r.sarosNumber,
      sarosMember: r.sarosMember,
    };
  } catch {
    return null;
  }
}

export function computeLunarEclipseDetailsSwiss(JD: number): LunarEclipseDetails | null {
  if (!loadSwisseph()) return null;
  try {
    // Pour une éclipse lunaire, la magnitude est globale (la Lune est
    // dans l'ombre de la Terre pour tous les observateurs côté nuit).
    // On passe des coords nulles, seuls azimuth/altitude diffèrent.
    const r = _swe.swe_lun_eclipse_how(JD, _swe.SEFLG_SWIEPH, 0, 0, 0);
    if (!r || "error" in r) return null;
    return {
      magnitude:          r.umbralMagnitude,
      penumbralMagnitude: r.penumbralMagnitude,
      kind:               decodeLunarRflag(r.rflag, _swe),
      saros:              r.sarosNumber,
      sarosMember:        r.sarosMember,
    };
  } catch {
    return null;
  }
}

// ARCHIVE-EPHEMERIDES-SWISSEPH-V1 applied

// ARCHIVE-EPHEMERIDES-SWISSEPH-CJS-FIX-V1 applied
