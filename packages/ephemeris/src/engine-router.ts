// ============================================================
// engine-router.ts — Sélection runtime du moteur de calcul
// ------------------------------------------------------------
// ARCHIVE-EPHEMERIDES-SWISSEPH-V1
//
// Lit la variable d'environnement ASTRO_ENGINE :
//   - "swisseph"  → moteur Swiss Ephemeris (mode Moshier)
//   - "astracore" → moteur AstraCore (port maison VSOP/Meeus)
//   - défaut     → "swisseph" si la lib charge, sinon "astracore"
//
// En cas d'échec de chargement de swisseph quand ASTRO_ENGINE=swisseph,
// on retombe sur astracore avec un warning console (gracieux). Cela
// évite un crash en cascade si le binaire natif n'est pas disponible
// (ex. lors d'un build sans node-gyp).
//
// Le moteur effectif est mis en cache au premier appel : aucun coût
// par requête.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import {
  computeChartFromJD as computeChartFromJDAstra,
  computeCurrentSky  as computeCurrentSkyAstra,
  computeChart       as computeChartAstra,
  allPositions       as allPositionsAstra,
  isRetrograde       as isRetrogradeAstra,
  moonPhase          as moonPhaseAstra,
  type ChartResult,
  type ChartOptions,
  type PlanetPosition,
  type MoonPhase,
} from "./astro-engine.js";

// Re-export des types pour permettre au reste du package (et aux
// consommateurs externes) d'utiliser le router comme remplacement
// drop-in de astro-engine côté types.
export type {
  ChartResult,
  ChartOptions,
  ZodiacSystem,
  HouseSystem,
  PlanetPosition,
  HouseSet,
  Aspect,
  AspectType,
  MoonPhase,
  CityCoords,
} from "./astro-engine.js";

import {
  computeChartFromJDSwiss,
  computeCurrentSkySwiss,
  allPositionsSwiss,
  isRetrogradeSwiss,
  moonPhaseSwiss,
  ensureSwissephLoaded,
  isSwissephLoaded,
  getSwissephLoadError,
} from "./swiss-engine.js";

// ──────────────────────────────────────────────────────────
// Résolution du moteur (une seule fois)
// ──────────────────────────────────────────────────────────

export type AstroEngineName = "swisseph" | "astracore";

let _activeEngine: AstroEngineName | null = null;
let _resolutionLog: string | null = null;

function resolveEngine(): AstroEngineName {
  if (_activeEngine) return _activeEngine;

  const requested = (process.env["ASTRO_ENGINE"] ?? "swisseph").toLowerCase().trim();

  if (requested === "astracore") {
    _activeEngine = "astracore";
    _resolutionLog = "ASTRO_ENGINE=astracore (explicite)";
    return _activeEngine;
  }

  // Par défaut ou "swisseph" : on tente swisseph
  if (ensureSwissephLoaded()) {
    _activeEngine = "swisseph";
    _resolutionLog = `ASTRO_ENGINE=${requested} → swisseph chargé OK`;
    return _activeEngine;
  }

  // Fallback gracieux
  const err = getSwissephLoadError();
  _activeEngine = "astracore";
  _resolutionLog =
    `ASTRO_ENGINE=${requested} demandé mais swisseph indisponible ` +
    `(${err ?? "raison inconnue"}) — fallback sur astracore`;
  console.warn(`[ephemeris/router] ${_resolutionLog}`);
  return _activeEngine;
}

/**
 * Nom du moteur actif (résolu au premier appel).
 */
export function getActiveEngine(): AstroEngineName {
  return resolveEngine();
}

/**
 * Diagnostic complet — utilisé par /admin/ephemeris/health.
 */
export function getEngineDiagnostic(): {
  active: AstroEngineName;
  requested: string;
  swissephLoaded: boolean;
  swissephError: string | null;
  resolutionLog: string;
} {
  const active = resolveEngine();
  return {
    active,
    requested: (process.env["ASTRO_ENGINE"] ?? "swisseph").toLowerCase().trim(),
    swissephLoaded: isSwissephLoaded(),
    swissephError: getSwissephLoadError(),
    resolutionLog: _resolutionLog ?? "(non résolu)",
  };
}

/**
 * RESET pour les tests (force une nouvelle résolution).
 * Ne pas utiliser en prod.
 */
export function _resetEngineForTests(): void {
  _activeEngine = null;
  _resolutionLog = null;
}

// ──────────────────────────────────────────────────────────
// API routée — mêmes signatures que astro-engine
// ──────────────────────────────────────────────────────────

export function computeChartFromJD(
  JD: number,
  latitude: number,
  longitude: number,
  opts: ChartOptions = {},
): ChartResult {
  if (resolveEngine() === "swisseph") {
    return computeChartFromJDSwiss(JD, latitude, longitude, opts);
  }
  return computeChartFromJDAstra(JD, latitude, longitude, opts);
}

export function computeCurrentSky(
  lat: number,
  lng: number,
  opts: ChartOptions = {},
): ChartResult {
  if (resolveEngine() === "swisseph") {
    return computeCurrentSkySwiss(lat, lng, opts);
  }
  return computeCurrentSkyAstra(lat, lng, opts);
}

// ──────────────────────────────────────────────────────────
// C3-FIX : helpers calcul-pur routés (allPositions / isRetrograde /
// moonPhase). Avant ce fix, ces helpers étaient exportés en direct
// depuis AstraCore — sky-events.service et event-relevance.service
// tournaient donc toujours en Meeus, même sous ASTRO_ENGINE=swisseph.
// ──────────────────────────────────────────────────────────

/** Positions géocentriques de tous les corps pour un JD UT — routé. */
export function allPositions(JD: number): Record<string, PlanetPosition> {
  return resolveEngine() === "swisseph"
    ? allPositionsSwiss(JD)
    : allPositionsAstra(JD);
}

/** Statut rétrograde d'un corps — routé. */
export function isRetrograde(key: string, JD: number): boolean {
  return resolveEngine() === "swisseph"
    ? isRetrogradeSwiss(key, JD)
    : isRetrogradeAstra(key, JD);
}

/** Phase lunaire pour un JD UT — routé. */
export function moonPhase(JD: number): MoonPhase {
  return resolveEngine() === "swisseph"
    ? moonPhaseSwiss(JD)
    : moonPhaseAstra(JD);
}

/**
 * computeChart (ancienne signature city-name) :
 * pas de version Swisseph dédiée — on reste sur AstraCore qui sait
 * résoudre une ville via getCity. Cette fonction est marquée
 * @deprecated dans astro-engine et ne devrait plus être utilisée
 * par le code applicatif (service.ts utilise computeChartFromJD).
 */
export function computeChart(
  dateStr: string,
  timeStr: string,
  city: string,
  opts: ChartOptions = {},
): ChartResult {
  return computeChartAstra(dateStr, timeStr, city, opts);
}

// ARCHIVE-EPHEMERIDES-SWISSEPH-V1 applied
