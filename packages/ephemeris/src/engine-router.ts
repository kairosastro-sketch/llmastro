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
  equatorialPositions as equatorialPositionsAstra, // ASTROCARTOGRAPHY-V1
  ACG_BODY_KEYS, // ASTROCARTOGRAPHY-V1 — set par défaut (filtre de corps)
  type ChartResult,
  type ChartOptions,
  type PlanetPosition,
  type MoonPhase,
} from "./astro-engine.js";

// ASTROCARTOGRAPHY-V1 : type équatorial + assemblage des lignes/parans.
import { type EquatorialCoord } from "./astrocartography.js";
import {
  computeAcgLines,
  findParans,
  type BodyLines,
  type Paran,
} from "./astrocartography.js";
import { gmstDeg } from "./astro-engine.js";

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
  HermeticLots,
} from "./astro-engine.js";

import {
  computeChartFromJDSwiss,
  computeCurrentSkySwiss,
  allPositionsSwiss,
  isRetrogradeSwiss,
  moonPhaseSwiss,
  equatorialPositionsSwiss, // ASTROCARTOGRAPHY-V1
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

  // ASTRO-NO-SILENT-FALLBACK-V1
  // swisseph est demandé mais ne charge pas. AstraCore (fallback maison
  // VSOP/Meeus) n'applique PAS de correction ΔT (TT vs UT) : il sert des
  // thèmes subtilement faux (Lune décalée de ~30″ en 1900, plusieurs degrés
  // pour des dates anciennes) SANS que personne ne le voie. On refuse donc
  // le fallback silencieux : en production il faut un opt-in EXPLICITE
  // (ASTRO_ALLOW_FALLBACK=true) pour accepter sciemment AstraCore. Hors prod
  // (dev local où le build natif swisseph échoue souvent) le fallback reste
  // autorisé avec un warning.
  const err = getSwissephLoadError();
  const isProd        = (process.env["NODE_ENV"] ?? "").toLowerCase() === "production";
  const allowFallback = (process.env["ASTRO_ALLOW_FALLBACK"] ?? "").toLowerCase() === "true";

  if (isProd && !allowFallback) {
    const msg =
      `[ephemeris/router] FATAL: ASTRO_ENGINE=${requested} mais swisseph ` +
      `indisponible (${err ?? "raison inconnue"}). Le fallback AstraCore ` +
      `n'applique pas ΔT et servirait des thèmes faux. Refus du fallback ` +
      `silencieux en production. Corrige le build/volume swisseph, ou pose ` +
      `ASTRO_ALLOW_FALLBACK=true pour accepter explicitement AstraCore.`;
    console.error(msg);
    throw new Error(msg);
  }

  _activeEngine = "astracore";
  _resolutionLog =
    `ASTRO_ENGINE=${requested} demandé mais swisseph indisponible ` +
    `(${err ?? "raison inconnue"}) — fallback sur astracore` +
    (allowFallback ? " (ASTRO_ALLOW_FALLBACK=true)" : " (hors production)");
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
 * ASTROCARTOGRAPHY-V1 — Positions équatoriales (RA/Dec) de tous les corps
 * tracés en astrocartographie, pour un JD UT — routé selon le moteur actif.
 */
export function equatorialPositions(JD: number): Record<string, EquatorialCoord> {
  return resolveEngine() === "swisseph"
    ? equatorialPositionsSwiss(JD)
    : equatorialPositionsAstra(JD);
}

/** ASTROCARTOGRAPHY-V1 — Résultat assemblé : corps + lignes + parans. */
export interface AstrocartographyResult {
  /** JD UT de l'instant calculé. */
  jd: number;
  /** Temps sidéral de Greenwich (degrés) à cet instant. */
  gst: number;
  /** Corps avec leurs coordonnées équatoriales (RA/Dec). */
  bodies: Array<{ key: string; ra: number; dec: number }>;
  /** Les 4 lignes d'angularité par corps. */
  lines: BodyLines[];
  /** Croisements (parans) entre corps. */
  parans: Paran[];
}

/** ASTROCARTOGRAPHY-V1 — Options d'assemblage de la carte. */
export interface ComputeAcgOptions {
  /**
   * Sous-ensemble de corps à tracer (clés de `equatorialPositions`). Par
   * défaut : les 10 luminaires/planètes classiques (ACG_BODY_KEYS), ce qui
   * préserve le comportement de la carte natale et de la carte « maintenant ».
   * Le curseur de dates passe ACG_SLOW_BODY_KEYS (Jupiter→Pluton + Nœud).
   */
  bodyKeys?: readonly string[];
  /** Pas d'échantillonnage des courbes AC/DC (degrés). Défaut moteur = 1.5. */
  latStep?: number;
}

/**
 * ASTROCARTOGRAPHY-V1 — Assemble la carte astrocartographique complète pour
 * un JD UT : positions équatoriales (moteur actif) → lignes AC/MC/DC/IC →
 * parans. Source unique de vérité de la géométrie, partagée par la carte
 * générale (home, JD = maintenant), la carte natale (JD = naissance) et le
 * curseur de dates (JD = mois choisi, corps lents uniquement).
 */
export function computeAstrocartography(
  JD: number,
  opts: ComputeAcgOptions = {},
): AstrocartographyResult {
  const eq  = equatorialPositions(JD);
  const gst = gmstDeg(JD);
  // Filtre de corps : défaut = les 10 classiques (northNode présent dans `eq`
  // mais exclu ici), donc aucune régression sur les cartes existantes.
  const allow = new Set(opts.bodyKeys ?? ACG_BODY_KEYS);
  const bodies = Object.entries(eq)
    .filter(([key]) => allow.has(key))
    .map(([key, c]) => ({ key, ra: c.ra, dec: c.dec }));
  const lineOpts = opts.latStep ? { latStep: opts.latStep } : {};
  const lines  = computeAcgLines(bodies, gst, lineOpts);
  const parans = findParans(lines);
  return { jd: JD, gst, bodies, lines, parans };
}

/** ASTROCARTOGRAPHY-V1 — JD UT de l'instant présent. */
export function jdNow(): number {
  return Date.now() / 86400000 + 2440587.5;
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
