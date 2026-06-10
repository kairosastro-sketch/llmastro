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
  allPositions,            // ✦ routé (C3-FIX)
  isRetrograde,            // ✦ routé (C3-FIX)
  moonPhase,               // ✦ routé (C3-FIX)
  equatorialPositions,     // ✦ routé (ASTROCARTOGRAPHY-V1)
  computeAstrocartography, // ✦ assemblage lignes+parans (ASTROCARTOGRAPHY-V1)
  jdNow,                   // ✦ JD UT « maintenant »
  getActiveEngine,
  getEngineDiagnostic,
} from "./engine-router.js";

export type { AstroEngineName, AstrocartographyResult, ComputeAcgOptions } from "./engine-router.js";

// ── Astrocartographie (ASTROCARTOGRAPHY-V1) ──────────────
// Module pur (lignes AC/MC/DC/IC + parans) + helpers GST/obliquité.
// `equatorialPositions` (ci-dessus, routé) fournit les RA/Dec à injecter.
export {
  eclipticToEquatorial,
  bodyLines,
  computeAcgLines,
  findParans,
  wrap180,
} from "./astrocartography.js";

export type {
  EquatorialCoord,
  EquatorialBody,
  GeoPoint,
  AngleType,
  BodyLines,
  Paran,
  AcgOptions,
} from "./astrocartography.js";

export {
  gmstDeg,
  obliquityDeg,
  ACG_BODY_KEYS,
  ACG_SLOW_BODY_KEYS, // ASTROCARTOGRAPHY-TIMELINE-V1 — corps lents du curseur
} from "./astro-engine.js";

// ── Helpers calcul-pur (depuis astro-engine, partagés par les 2 moteurs) ──
// C3-FIX : allPositions / isRetrograde / moonPhase ne sont plus exportés
// ici en direct — ils passent désormais par engine-router (bloc ci-dessus)
// pour suivre le moteur actif (ASTRO_ENGINE).
export {
  calculateHouses,
  calculateHousesByCoords, // ✦ variante coord-directe
  calculateAspects,
  houseOfLongitude,
  partOfFortune,
  ayanamsa,
  toSidereal,
  n360,
  jd,
  jdFromLocal,             // @deprecated — utiliser localToUTC
  isDST,                   // @deprecated — remplacé par IANA tzdata
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

// ── Types partagés (EPHEMERIS-DEEP-CONSOLIDATION-V1) ─────
// Le package ne contient plus de liste hardcodée de villes.
// Le service ephemeris obtient les coordonnées via un resolver
// injecté au boot (ephemerisService.setCityResolver()), typiquement
// branché sur la table Postgres `cities` côté API.
export { CityNotFoundError } from "./types.js";
export type { CityCoords, CityResolver } from "./types.js";

// ── Éclipses — magnitude précise via Swiss Ephemeris ──────
// ECLIPSE-MAGNITUDE-V1 : enrichit la classification qualitative
// (`total`/`partial`/`marginal`, basée distance Soleil-Nœud) avec
// la vraie magnitude renvoyée par Swiss Ephemeris. Caller doit
// gérer le null (swisseph indispo / mode astracore fallback).
export {
  computeSolarEclipseDetailsSwiss,
  computeLunarEclipseDetailsSwiss,
} from "./swiss-engine.js";

export type {
  SolarEclipseDetails,
  LunarEclipseDetails,
  SolarEclipseKind,
  LunarEclipseKind,
} from "./swiss-engine.js";

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

// EPHEMERIS-DEEP-CONSOLIDATION-V1 applied
