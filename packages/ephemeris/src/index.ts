// ============================================================
// @astro-platform/ephemeris — API publique
// ============================================================

// ── Moteur astro (inchangé) ───────────────────────────────
export {
  computeChart,            // @deprecated — conservé pour compat
  computeChartFromJD,      // ✦ entrée canonique
  computeCurrentSky,
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
