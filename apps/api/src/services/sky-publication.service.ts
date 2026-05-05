// ============================================================
// apps/api/src/services/sky-publication.service.ts
// CIEL-PUBLIC-V1-DATA-POSITIONS
// ------------------------------------------------------------
// Calcule, persiste et récupère les publications éphémérides
// publiques pour 4 cadences (jour/semaine/mois/an).
//
// V1.1 (POSITIONS) : positions des planètes + phase Lune + aspects
//                    mutuels actuels. Pas d'événements à venir.
// V1.2 (EVENTS)    : étendra le payload `data` avec ingrès, stations
//                    rétrogrades, lunaisons, éclipses (à venir).
// ============================================================

import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  skyPublication,
  type NewSkyPublicationRow,
  type SkyPublicationRow,
} from "../db/schema.js";
import { ephemerisService } from "@astro-platform/ephemeris";
import {
  computeTransitAspects,
  type PlanetPosition,
  type TransitAspect,
} from "./transits.service.js";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type Cadence = "day" | "week" | "month" | "year";

const VALID_CADENCES: readonly Cadence[] = ["day", "week", "month", "year"] as const;

export function isCadence(s: string): s is Cadence {
  return (VALID_CADENCES as readonly string[]).includes(s);
}

export const CADENCES: readonly Cadence[] = VALID_CADENCES;

/**
 * Payload stocké dans `sky_publication.data` (JSONB).
 * Schema versionné : EVENTS archive ajoutera un champ `events` sans
 * casser la rétro-compat (lecture tolérante).
 */
export interface SkyData {
  /** ISO 8601 — moment exact où le calcul a été fait */
  referenceDate: string;
  /** Positions de toutes les planètes — clés "sun", "moon", … */
  planets: Record<string, PlanetPosition>;
  /** Ascendant — toujours calculé pour Paris */
  asc: number;
  /** Milieu du Ciel — toujours calculé pour Paris */
  mc: number;
  /** Phase de Lune (shape du package ephemeris, opaque ici) */
  moonPhase: unknown | null;
  /** Aspects mutuels entre les planètes du moment, dédupliqués */
  aspects: TransitAspect[];
}

// ──────────────────────────────────────────────────────────
// Réf de localisation pour le ciel public
// ──────────────────────────────────────────────────────────
// Paris est notre point de référence (utilisateurs majoritairement FR
// et l'ASC/MC dépendent de la latitude/longitude).
const REF_LAT = 48.857;
const REF_LNG = 2.352;

// ──────────────────────────────────────────────────────────
// Period bounds — convention UTC (cf. design doc)
// ──────────────────────────────────────────────────────────

/**
 * Retourne [start, end) de la période courante en UTC pour `cadence`.
 *
 * - day   : [today 00:00 UTC, tomorrow 00:00 UTC)
 * - week  : [Monday 00:00 UTC, next Monday 00:00 UTC) — ISO 8601
 * - month : [1st 00:00 UTC, next 1st 00:00 UTC)
 * - year  : [Jan 1st 00:00 UTC, next Jan 1st 00:00 UTC)
 */
export function getPeriodBounds(cadence: Cadence, ref: Date = new Date()): { start: Date; end: Date } {
  const Y = ref.getUTCFullYear();
  const M = ref.getUTCMonth();
  const D = ref.getUTCDate();

  switch (cadence) {
    case "day": {
      const start = new Date(Date.UTC(Y, M, D, 0, 0, 0, 0));
      const end = new Date(Date.UTC(Y, M, D + 1, 0, 0, 0, 0));
      return { start, end };
    }
    case "week": {
      // ISO week — lundi-démarrage. getUTCDay() : 0 = dim, 1 = lun, …
      const refUtc = new Date(Date.UTC(Y, M, D, 0, 0, 0, 0));
      const dow = refUtc.getUTCDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      const start = new Date(Date.UTC(Y, M, D + offset, 0, 0, 0, 0));
      const end = new Date(Date.UTC(Y, M, D + offset + 7, 0, 0, 0, 0));
      return { start, end };
    }
    case "month": {
      const start = new Date(Date.UTC(Y, M, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(Y, M + 1, 1, 0, 0, 0, 0));
      return { start, end };
    }
    case "year": {
      const start = new Date(Date.UTC(Y, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(Y + 1, 0, 1, 0, 0, 0, 0));
      return { start, end };
    }
  }
}

// ──────────────────────────────────────────────────────────
// Aspect deduplication
// ──────────────────────────────────────────────────────────

/**
 * `computeTransitAspects(planets, planets)` génère les aspects pour chaque
 * paire (A, B) ET (B, A), plus chaque planète vs elle-même (orbe 0). On filtre.
 */
function uniqueMutualAspects(aspects: TransitAspect[]): TransitAspect[] {
  const seen = new Set<string>();
  const out: TransitAspect[] = [];
  for (const a of aspects) {
    if (a.transitPlanet === a.natalPlanet) continue;
    const pair = [a.transitPlanet, a.natalPlanet].sort().join(":");
    const key = `${pair}:${a.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

// ──────────────────────────────────────────────────────────
// Compute SkyData (pure, no DB)
// ──────────────────────────────────────────────────────────

export async function computeSkyData(): Promise<SkyData> {
  const chart = await ephemerisService.getCurrentSky(REF_LAT, REF_LNG);
  const planets = (chart.planets ?? {}) as Record<string, PlanetPosition>;

  const rawAspects = computeTransitAspects(planets, planets);
  const aspects = uniqueMutualAspects(rawAspects);

  return {
    referenceDate: new Date().toISOString(),
    planets,
    asc: chart.asc ?? 0,
    mc: chart.mc ?? 0,
    moonPhase: chart.moonPhase ?? null,
    aspects,
  };
}

// ──────────────────────────────────────────────────────────
// DB ops
// ──────────────────────────────────────────────────────────

export async function getSkyPublication(cadence: Cadence): Promise<SkyPublicationRow | null> {
  const { start } = getPeriodBounds(cadence);
  const rows = await db
    .select()
    .from(skyPublication)
    .where(and(eq(skyPublication.cadence, cadence), eq(skyPublication.periodStart, start)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Idempotent. Si la publication pour la période courante existe, la retourne.
 * Sinon : compute la SkyData, INSERT, retourne.
 *
 * Race-safe via UNIQUE(cadence, period_start) : si deux callers concurrents
 * tentent l'INSERT simultanément, le 2ème throw → on re-fetch et retourne.
 */
export async function ensureSkyPublication(cadence: Cadence): Promise<SkyPublicationRow> {
  const existing = await getSkyPublication(cadence);
  if (existing) return existing;

  const { start, end } = getPeriodBounds(cadence);
  const data = await computeSkyData();

  const row: NewSkyPublicationRow = {
    cadence,
    periodStart: start,
    periodEnd: end,
    data,
  };

  try {
    const inserted = await db.insert(skyPublication).values(row).returning();
    if (inserted[0]) return inserted[0];
  } catch {
    // Concurrent insert won — re-fetch ci-dessous.
  }

  const after = await getSkyPublication(cadence);
  if (!after) {
    throw new Error(`[sky-publication] failed to ensure publication for cadence=${cadence}`);
  }
  return after;
}

// CIEL-PUBLIC-V1-DATA-POSITIONS service applied
