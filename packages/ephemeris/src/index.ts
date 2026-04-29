// ============================================================
// @astro-platform/ephemeris — API publique
// ============================================================

// ── Moteur astro — fonctions routées via engine-router ─────
// ARCHIVE-EPHEMERIDES-SWISSEPH-V1 : computeChart/computeChartFromJD/
// computeCurrentSky délèguent à swiss-engine ou astro-engine selon
// la variable d'env ASTRO_ENGINE.
export {
  computeChart,            // @deprecated — conservé pour compat
  computeChartFromJD,      // ✦ entrée canonique (routée)
  computeCurrentSky,       // ✦ routée
  getActiveEngine,
  getEngineDiagnostic,
} from "./engine-router.js";

export type { AstroEngineName } from "./engine-router.js";

// ── Helpers calcul-pur (depuis astro-engine, partagés par les 2 moteurs) ──
export {
  allPositions,
  calculateHouses,
  calculateHousesByCoords, // ✦ variante coord-directe
  calculateAspects,
  houseOfLongitude,
  isRetrograde,
  moonPhase,
  partOfFortune,
  ayanamsa,
  toSidereal,
  n360,
  jd,
  jdFromLocal,             // @deprecated — utiliser localToUTC
  isDST,                   // @deprecated — remplacé par IANA tzdata
  getCity,
  ASPECT_TYPES,
} from "./astro-engine.js";

export type {
  ZodiacSystem,
  HouseSystem,
  CityCoords as AstroCityCoords,
  PlanetPosition,
  Aspect,
  AspectType,
  HouseSet,
  MoonPhase,
  ChartResult,
  ChartOptions,
} from "./astro-engine.js";

// ── Base de villes (IANA tz) ─────────────────────────────
export {
  CITIES,
  CITY_NAMES,
  getCity as getCityWithIana,
  hasCity,
  suggestCities,
  CityNotFoundError,
} from "./cities.js";

export type { CityCoords } from "./cities.js";

// ── Conversion heure locale → UTC (Luxon + IANA tzdata) ──
export {
  localToUTC,
  toLegacyPair,
  TimezoneError,
} from "./time-utc.service.js";

export type {
  TimeResolution,
  UtcConversionResult,
} from "./time-utc.service.js";

// ── Service haut niveau (cache Redis + API propre) ───────
export {
  ephemerisService,
  chartCacheKeyPrefix,
  cacheDelPrefix,
} from "./service.js";

export type {
  NatalChartInput,
  ChartMeta,
  EnrichedChart,
  EnrichedPlanet,
  EnrichedAspect,
  EnrichedHouse,
} from "./service.js";

// ARCHIVE-EPHEMERIDES-SWISSEPH-V1 applied
