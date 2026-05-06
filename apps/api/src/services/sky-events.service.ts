// ============================================================
// apps/api/src/services/sky-events.service.ts
// CIEL-PUBLIC-V1-DATA-EVENTS
// ------------------------------------------------------------
// Détecteurs d'événements astronomiques pour une fenêtre [start, end) :
//
//   • Ingrès        — changements de signe planétaires
//   • Stations R/D  — passages rétrograde ↔ direct
//   • Lunaisons     — Nouvelle / Premier Quartier / Pleine / Dernier Quartier
//   • Éclipses      — dérivées des lunaisons (NL/FL avec Lune proche d'un nœud)
//
// Stratégie : sampling à pas adaptatifs par planète/détecteur, puis bisection
// pour précision (~5 min ingress, ~30 min stations/lunations).
// Pure : aucun side effect, aucun accès DB. Appelé par sky-publication.service.
// ============================================================

import {
  allPositions,
  isRetrograde,
  jd as toJulianDay,
  moonPhase,
} from "@astro-platform/ephemeris";

// ──────────────────────────────────────────────────────────
// Types — payload JSONB stocké dans sky_publication.data.events
// ──────────────────────────────────────────────────────────

export interface IngressEvent {
  type: "ingress";
  date: string; // ISO 8601 (UTC)
  planet: string;
  fromSign: number; // 0–11
  toSign: number;   // 0–11
}

export interface StationEvent {
  type: "station";
  date: string;
  planet: string;
  direction: "retrograde" | "direct";
}

export type LunationPhase = "new" | "first_quarter" | "full" | "last_quarter";

export interface LunationEvent {
  type: "lunation";
  date: string;
  phase: LunationPhase;
  sign: number; // sign of Moon at the lunation
}

export interface EclipseEvent {
  type: "eclipse";
  date: string;
  kind: "solar" | "lunar";
  /** ISO date of the lunation this eclipse is associated with */
  lunation: string;
}

export interface SkyEvents {
  ingresses: IngressEvent[];
  stations:  StationEvent[];
  lunations: LunationEvent[];
  eclipses:  EclipseEvent[];
}

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY  = 24 * MS_PER_HOUR;

// Pas d'échantillonnage par planète pour la détection d'ingrès.
const INGRESS_SAMPLE_HOURS: Record<string, number> = {
  moon:      6,
  sun:       24,
  mercury:   24,
  venus:     24,
  mars:      24,
  jupiter:   24 * 7,
  saturn:    24 * 30,
  uranus:    24 * 30,
  neptune:   24 * 30,
  pluto:     24 * 30,
  northNode: 24 * 30,
  southNode: 24 * 30,
};

// Stations : Soleil et Lune ne rétrogradent jamais ; les nœuds sont
// (faux) toujours rétrogrades par convention — on les ignore aussi.
const STATION_SAMPLE_HOURS: Record<string, number> = {
  mercury: 24,
  venus:   24,
  mars:    24,
  jupiter: 24 * 3,
  saturn:  24 * 3,
  uranus:  24 * 7,
  neptune: 24 * 7,
  pluto:   24 * 7,
};

const LUNATION_SAMPLE_HOURS = 6;

// Mapping interne phase moonPhase().key → phase majeure
// (moonPhase retourne 9 buckets qu'on ramène à 4)
const PHASE_KEY_TO_LUNATION: Record<string, LunationPhase | null> = {
  moon_new:    "new",
  moon_firstq: "first_quarter",
  moon_full:   "full",
  moon_lastq:  "last_quarter",
  moon_waxc:   null,
  moon_waxg:   null,
  moon_wang:   null,
  moon_wanc:   null,
};

// Orbes de détection éclipse (depuis le nœud lunaire, en degrés écliptique).
const ECLIPSE_SOLAR_ORB = 18;
const ECLIPSE_LUNAR_ORB = 12;

// Précision de bisection
const BISECT_MAX_ITER = 8;

// ──────────────────────────────────────────────────────────
// Helpers JD ↔ Date
// ──────────────────────────────────────────────────────────

/** Convertit un Date UTC en Julian Day */
function dateToJD(d: Date): number {
  return toJulianDay(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600,
  );
}

/** Génère des timestamps à pas régulier sur [start, end] (inclus, inclus) */
function* sampleRange(start: Date, end: Date, stepHours: number): Generator<Date> {
  const stepMs = stepHours * MS_PER_HOUR;
  let t = start.getTime();
  const endMs = end.getTime();
  while (t <= endMs) {
    yield new Date(t);
    t += stepMs;
  }
  // garantit qu'on inclut bien `end` exact
  if (t - stepMs < endMs) yield new Date(endMs);
}

/** Bisection : trouve t* dans [lo, hi] tel que f passe de v0 à v1 */
function bisect<T>(
  lo: Date,
  hi: Date,
  fn: (d: Date) => T,
  v0: T,
): Date {
  for (let i = 0; i < BISECT_MAX_ITER; i++) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    if (fn(mid) === v0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return new Date((lo.getTime() + hi.getTime()) / 2);
}

// ──────────────────────────────────────────────────────────
// 1. Ingrès — changement de signe (signIdx) d'une planète
// ──────────────────────────────────────────────────────────

function planetSignAt(d: Date, planet: string): number {
  const pos = allPositions(dateToJD(d));
  const p = pos[planet];
  return p ? p.signIdx : -1;
}

function detectIngressesForPlanet(
  start: Date,
  end: Date,
  planet: string,
  stepHours: number,
): IngressEvent[] {
  const out: IngressEvent[] = [];
  let prevSign: number | null = null;
  let prevDate: Date | null = null;

  for (const t of sampleRange(start, end, stepHours)) {
    const sign = planetSignAt(t, planet);
    if (prevSign !== null && prevDate !== null && sign !== prevSign && sign >= 0 && prevSign >= 0) {
      const ingressDate = bisect(prevDate, t, (d) => planetSignAt(d, planet), prevSign);
      out.push({
        type: "ingress",
        date: ingressDate.toISOString(),
        planet,
        fromSign: prevSign,
        toSign: sign,
      });
    }
    prevSign = sign;
    prevDate = t;
  }
  return out;
}

export function detectIngresses(start: Date, end: Date): IngressEvent[] {
  const out: IngressEvent[] = [];
  for (const [planet, hours] of Object.entries(INGRESS_SAMPLE_HOURS)) {
    out.push(...detectIngressesForPlanet(start, end, planet, hours));
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ──────────────────────────────────────────────────────────
// 2. Stations rétrogrades / directes
// ──────────────────────────────────────────────────────────

function detectStationsForPlanet(
  start: Date,
  end: Date,
  planet: string,
  stepHours: number,
): StationEvent[] {
  const out: StationEvent[] = [];
  const fn = (d: Date) => isRetrograde(planet, dateToJD(d));

  let prev: boolean | null = null;
  let prevDate: Date | null = null;

  for (const t of sampleRange(start, end, stepHours)) {
    const r = fn(t);
    if (prev !== null && prevDate !== null && r !== prev) {
      const stationDate = bisect(prevDate, t, fn, prev);
      out.push({
        type: "station",
        date: stationDate.toISOString(),
        planet,
        direction: r ? "retrograde" : "direct",
      });
    }
    prev = r;
    prevDate = t;
  }
  return out;
}

export function detectStations(start: Date, end: Date): StationEvent[] {
  const out: StationEvent[] = [];
  for (const [planet, hours] of Object.entries(STATION_SAMPLE_HOURS)) {
    out.push(...detectStationsForPlanet(start, end, planet, hours));
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ──────────────────────────────────────────────────────────
// 3. Lunaisons — 4 phases majeures
// ──────────────────────────────────────────────────────────

function lunationKeyAt(d: Date): string {
  return moonPhase(dateToJD(d)).key;
}

export function detectLunations(start: Date, end: Date): LunationEvent[] {
  const out: LunationEvent[] = [];
  let prev: string | null = null;
  let prevDate: Date | null = null;

  for (const t of sampleRange(start, end, LUNATION_SAMPLE_HOURS)) {
    const key = lunationKeyAt(t);
    if (prev !== null && prevDate !== null && key !== prev) {
      const major = PHASE_KEY_TO_LUNATION[key];
      if (major) {
        // Bisect au moment où la phase est entrée
        const lunationDate = bisect(prevDate, t, lunationKeyAt, prev);
        const pos = allPositions(dateToJD(lunationDate));
        const moonSign = pos["moon"]?.signIdx ?? 0;
        out.push({
          type: "lunation",
          date: lunationDate.toISOString(),
          phase: major,
          sign: moonSign,
        });
      }
    }
    prev = key;
    prevDate = t;
  }
  return out;
}

// ──────────────────────────────────────────────────────────
// 4. Éclipses — dérivées des lunaisons NL / FL
// ──────────────────────────────────────────────────────────

function angularDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

export function detectEclipses(lunations: LunationEvent[]): EclipseEvent[] {
  const out: EclipseEvent[] = [];
  for (const lun of lunations) {
    if (lun.phase !== "new" && lun.phase !== "full") continue;
    const pos = allPositions(dateToJD(new Date(lun.date)));
    const sun = pos["sun"]?.longitude;
    const node = pos["northNode"]?.longitude;
    if (sun == null || node == null) continue;

    const distSun = angularDistance(sun, node);
    if (lun.phase === "new" && distSun <= ECLIPSE_SOLAR_ORB) {
      out.push({ type: "eclipse", date: lun.date, kind: "solar", lunation: lun.date });
    } else if (lun.phase === "full" && distSun <= ECLIPSE_LUNAR_ORB) {
      // Pour une éclipse lunaire, c'est la Lune (opposée au Soleil) qui est proche
      // d'un nœud → équivalent à |sun - node| ≤ orb (le Soleil est à l'opposé du nœud)
      out.push({ type: "eclipse", date: lun.date, kind: "lunar", lunation: lun.date });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────
// API publique
// ──────────────────────────────────────────────────────────

export function computeAllEvents(start: Date, end: Date): SkyEvents {
  const ingresses = detectIngresses(start, end);
  const stations  = detectStations(start, end);
  const lunations = detectLunations(start, end);
  const eclipses  = detectEclipses(lunations);
  return { ingresses, stations, lunations, eclipses };
}

// CIEL-PUBLIC-V1-DATA-EVENTS service applied
