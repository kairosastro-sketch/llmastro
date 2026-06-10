// ARCHIVE-LANDING-EPHEMERIDES-V2
// Route publique (sans auth) pour afficher le ciel du moment sur la landing.
// Utilise `ephemerisService.getCurrentSky()` du package shared.
//
// Cache mémoire process-local (Map<string, {data, expiresAt}>) avec TTL 10 min.
// Pourquoi pas Redis : pas de client Redis exporté en singleton dans apps/api/src/lib/.
// Pour 1 process api + ~10 visites/min sur la landing, cache mémoire suffit
// largement. Si on passe à plusieurs replicas, on migrera vers Redis.

import type { FastifyPluginAsync } from "fastify";
import {
  ephemerisService,
  computeAstrocartography,
  jdNow,
  ACG_SLOW_BODY_KEYS,
} from "@astro-platform/ephemeris";

// Paris par défaut. Le client peut passer ?lat=&lng= pour personnaliser.
const DEFAULT_LAT = 48.857;
const DEFAULT_LNG = 2.352;

// TTL 10 min : les positions changent peu en 10 min, négligeable visuellement
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedEntry {
  data:      unknown;
  expiresAt: number;
}

// Cache process-local. Limite de taille raisonnable (10 entries max
// = ~10 lat/lng différents possibles).
const skyCache = new Map<string, CachedEntry>();
const MAX_CACHE_SIZE = 16;

// Arrondi à la "tranche de 10 min" pour aligner les caches inter-clients
function roundedTimestamp(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const m = now.getMinutes();
  now.setMinutes(m - (m % 10));
  return now.toISOString();
}

// Purge les entrées expirées (best-effort, appelé à chaque hit)
function purgeExpired(): void {
  const now = Date.now();
  for (const [k, v] of skyCache.entries()) {
    if (v.expiresAt <= now) skyCache.delete(k);
  }
  // Si on dépasse encore MAX_CACHE_SIZE après purge, on vire les plus vieux
  if (skyCache.size > MAX_CACHE_SIZE) {
    const sorted = Array.from(skyCache.entries())
      .sort(([, a], [, b]) => a.expiresAt - b.expiresAt);
    const toRemove = sorted.slice(0, skyCache.size - MAX_CACHE_SIZE);
    for (const [k] of toRemove) skyCache.delete(k);
  }
}

// ── ASTROCARTOGRAPHY-TIMELINE-V1 ────────────────────────────
// Curseur de dates de la carte générale : 25 frames mensuelles (−12…+12 mois
// autour du mois courant), corps LENTS uniquement (Jupiter→Pluton + Nœud).
// Cache séparé (payload plus lourd) : on recalcule au plus une fois par mois.
const TIMELINE_SPAN = 12;            // ±12 mois
const TIMELINE_LAT_STEP = 3;         // courbes AC/DC échantillonnées plus large (payload léger)
const TIMELINE_TTL_MS = 6 * 60 * 60 * 1000;

let timelineCache: { key: string; data: unknown; expiresAt: number } | null = null;

/** JD UT d'une Date JS. */
function jdFromDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

/** Arrondi à 1 décimale (réduit le payload, précision suffisante au tracé). */
function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

interface TimelineLine {
  key: string; mcLng: number; icLng: number;
  asc: { lat: number; lng: number }[];
  dsc: { lat: number; lng: number }[];
}

/** Allège une BodyLines : coordonnées arrondies, champs strictement utiles. */
function slimLine(l: {
  key: string; mcLng: number; icLng: number;
  asc: { lat: number; lng: number }[];
  dsc: { lat: number; lng: number }[];
}): TimelineLine {
  return {
    key: l.key,
    mcLng: r1(l.mcLng),
    icLng: r1(l.icLng),
    asc: l.asc.map((p) => ({ lat: r1(p.lat), lng: r1(p.lng) })),
    dsc: l.dsc.map((p) => ({ lat: r1(p.lat), lng: r1(p.lng) })),
  };
}

export const publicEphemerisRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /public/ephemeris/sky/now?lat=...&lng=...
  fastify.get<{
    Querystring: { lat?: string; lng?: string };
  }>("/sky/now", async (req, reply) => {
    const lat = req.query.lat ? Number(req.query.lat) : DEFAULT_LAT;
    const lng = req.query.lng ? Number(req.query.lng) : DEFAULT_LNG;

    // Validation simple
    if (Number.isNaN(lat) || Number.isNaN(lng)
        || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_COORDS", message: "Invalid lat/lng" },
      });
    }

    const cacheKey = `${lat.toFixed(2)}:${lng.toFixed(2)}:${roundedTimestamp()}`;

    // Tente le cache mémoire
    const cached = skyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return reply.send({ success: true, data: cached.data, cached: true });
    }

    // Calcule le ciel courant
    let chart;
    try {
      chart = await ephemerisService.getCurrentSky(lat, lng);
    } catch (err) {
      req.log.error({ err }, "[public-ephemeris] getCurrentSky failed");
      return reply.code(500).send({
        success: false,
        error: { code: "EPHEMERIS_ERROR", message: "Failed to compute current sky" },
      });
    }

    // Payload allégé : on ne renvoie que ce que la landing affiche
    const payload = {
      date:      new Date().toISOString(),
      lat,
      lng,
      planets:   chart.planets ?? {},
      asc:       chart.asc ?? 0,
      mc:        chart.mc ?? 0,
      moonPhase: chart.moonPhase ?? null,
    };

    // Stocke dans le cache
    purgeExpired();
    skyCache.set(cacheKey, {
      data:      payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return reply.send({ success: true, data: payload, cached: false });
  });

  // ASTROCARTOGRAPHY-V1
  // GET /public/ephemeris/astrocartography
  // Carte GÉNÉRALE du jour : lignes planétaires AC/MC/DC/IC + parans pour
  // l'instant présent, indépendamment de tout thème utilisateur. Aucune
  // coordonnée requise (les lignes sont globales). Même cache mémoire 10 min
  // que /sky/now → coût quasi nul par visiteur, identique pour tous.
  fastify.get("/astrocartography", async (req, reply) => {
    const cacheKey = `acg:${roundedTimestamp()}`;

    const cached = skyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return reply.send({ success: true, data: cached.data, cached: true });
    }

    let acg;
    try {
      acg = computeAstrocartography(jdNow());
    } catch (err) {
      req.log.error({ err }, "[public-ephemeris] computeAstrocartography failed");
      return reply.code(500).send({
        success: false,
        error: { code: "EPHEMERIS_ERROR", message: "Failed to compute astrocartography" },
      });
    }

    const payload = {
      date:   new Date().toISOString(),
      jd:     acg.jd,
      gst:    acg.gst,
      bodies: acg.bodies,
      lines:  acg.lines,
      parans: acg.parans,
    };

    purgeExpired();
    skyCache.set(cacheKey, {
      data:      payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return reply.send({ success: true, data: payload, cached: false });
  });

  // ASTROCARTOGRAPHY-TIMELINE-V1
  // GET /public/ephemeris/astrocartography/timeline
  // Frames mensuelles ±12 mois (corps lents) pour le curseur de dates de la
  // carte générale. La frame centrale (offset 0) = mois courant. Le client
  // dessine la frame choisie ; aucune coordonnée requise (lignes globales).
  fastify.get("/astrocartography/timeline", async (req, reply) => {
    const now = new Date();
    // Ancrage : 15 du mois courant à 12:00 UTC (stable, milieu de mois).
    const monthKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;

    if (timelineCache && timelineCache.key === monthKey
        && timelineCache.expiresAt > Date.now()) {
      return reply.send({ success: true, data: timelineCache.data, cached: true });
    }

    let frames;
    try {
      frames = [];
      for (let off = -TIMELINE_SPAN; off <= TIMELINE_SPAN; off++) {
        const d = new Date(Date.UTC(
          now.getUTCFullYear(), now.getUTCMonth() + off, 15, 12, 0, 0,
        ));
        const acg = computeAstrocartography(jdFromDate(d), {
          bodyKeys: ACG_SLOW_BODY_KEYS,
          latStep:  TIMELINE_LAT_STEP,
        });
        frames.push({
          offset: off,
          date:   d.toISOString(),
          jd:     acg.jd,
          lines:  acg.lines.map(slimLine),
        });
      }
    } catch (err) {
      req.log.error({ err }, "[public-ephemeris] astrocartography timeline failed");
      return reply.code(500).send({
        success: false,
        error: { code: "EPHEMERIS_ERROR", message: "Failed to compute astrocartography timeline" },
      });
    }

    const payload = {
      generatedAt:  now.toISOString(),
      span:         TIMELINE_SPAN,   // ±span mois
      anchorIndex:  TIMELINE_SPAN,   // index de la frame « aujourd'hui »
      bodyKeys:     ACG_SLOW_BODY_KEYS,
      frames,
    };

    timelineCache = {
      key:       monthKey,
      data:      payload,
      expiresAt: Date.now() + TIMELINE_TTL_MS,
    };

    return reply.send({ success: true, data: payload, cached: false });
  });
};
