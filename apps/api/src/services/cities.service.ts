// ============================================================
// apps/api/src/services/cities.service.ts
// ------------------------------------------------------------
// Recherche de villes pour l'autocomplete frontend.
//
// v2 : ajout des champs admin1_code et admin1_name pour
// distinguer les homonymes (Paris/Île-de-France vs Paris/Texas).
// ============================================================

import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../db/index.js";

// ─────────────────────────────────────────────────────────────
// Redis (cache gracieux)
// ─────────────────────────────────────────────────────────────

let _redis: any = null;
async function getRedis() {
  if (_redis !== null) return _redis;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: process.env["REDIS_URL"] ?? "redis://redis:6379" });
    client.on("error", () => { /* silent */ });
    await client.connect();
    _redis = client;
    return client;
  } catch {
    _redis = false;
    return null;
  }
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = await getRedis();
    if (!r) return null;
    const v = await r.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch { return null; }
}

async function cacheSet(key: string, data: unknown, ttl = 3600): Promise<void> {
  try {
    const r = await getRedis();
    if (!r) return;
    await r.setEx(key, ttl, JSON.stringify(data));
  } catch { /* silent */ }
}

// ─────────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────────

export interface CitySearchResult {
  geonameid:   number;
  name:        string;
  asciiName:   string;
  countryCode: string;
  /** Code admin1 (ex. "TX" pour Texas, "11" pour Île-de-France). */
  admin1Code:  string;
  /** Nom admin1 (ex. "Texas", "Île-de-France"). Vide si inconnu. */
  admin1Name:  string;
  population:  number;
  latitude:    number;
  longitude:   number;
  ianaTz:      string;
  score:       number;
}

export interface CitySearchOptions {
  limit?:       number;
  countryCode?: string;
}

// ─────────────────────────────────────────────────────────────
// Normalisation query
// ─────────────────────────────────────────────────────────────

function normalizeQuery(q: string): string {
  return q
    .trim()
    .normalize("NFD")
    .slice(0, 100);
}

function makeCacheKey(q: string, opts: CitySearchOptions): string {
  const payload = JSON.stringify({
    q: q.toLowerCase(),
    cc: opts.countryCode ?? "",
    l: opts.limit ?? 10,
    v: 2, // bump cache version after admin1 addition
  });
  return "cities:v2:" + createHash("sha1").update(payload).digest("hex").slice(0, 16);
}

// ─────────────────────────────────────────────────────────────
// Recherche
// ─────────────────────────────────────────────────────────────

export async function searchCities(
  rawQuery: string,
  opts: CitySearchOptions = {},
): Promise<CitySearchResult[]> {
  const q = normalizeQuery(rawQuery);
  if (q.length < 2) return [];

  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const countryCode = opts.countryCode?.toUpperCase().slice(0, 2);

  const cacheKey = makeCacheKey(q, { limit, countryCode });
  const cached = await cacheGet<CitySearchResult[]>(cacheKey);
  if (cached) return cached;

  let rows: CitySearchResult[];

  if (q.length <= 3) {
    const result = await db.execute<{
      geonameid: number; name: string; ascii_name: string;
      country_code: string; admin1_code: string; admin1_name: string;
      population: number; latitude: number; longitude: number; iana_tz: string;
      score: number;
    }>(sql`
      SELECT geonameid, name, ascii_name, country_code,
             admin1_code, admin1_name,
             population, latitude, longitude, iana_tz,
             1.0 AS score
      FROM cities
      WHERE (name ILIKE ${q + "%"} OR ascii_name ILIKE ${q + "%"})
        ${countryCode ? sql`AND country_code = ${countryCode}` : sql.empty()}
      ORDER BY population DESC
      LIMIT ${limit}
    `);
    rows = result.rows.map(r => ({
      geonameid:   r.geonameid,
      name:        r.name,
      asciiName:   r.ascii_name,
      countryCode: r.country_code,
      admin1Code:  r.admin1_code ?? "",
      admin1Name:  r.admin1_name ?? "",
      population:  r.population,
      latitude:    r.latitude,
      longitude:   r.longitude,
      ianaTz:      r.iana_tz,
      score:       r.score,
    }));
  } else {
    const result = await db.execute<{
      geonameid: number; name: string; ascii_name: string;
      country_code: string; admin1_code: string; admin1_name: string;
      population: number; latitude: number; longitude: number; iana_tz: string;
      score: number;
    }>(sql`
      WITH candidates AS (
        SELECT geonameid, name, ascii_name, country_code,
               admin1_code, admin1_name,
               population, latitude, longitude, iana_tz,
               GREATEST(
                 similarity(name, ${q}),
                 similarity(ascii_name, ${q})
               ) AS score
        FROM cities
        WHERE (name % ${q} OR ascii_name % ${q})
          ${countryCode ? sql`AND country_code = ${countryCode}` : sql.empty()}
      )
      SELECT *
      FROM candidates
      ORDER BY
        score DESC,
        population DESC
      LIMIT ${limit}
    `);
    rows = result.rows.map(r => ({
      geonameid:   r.geonameid,
      name:        r.name,
      asciiName:   r.ascii_name,
      countryCode: r.country_code,
      admin1Code:  r.admin1_code ?? "",
      admin1Name:  r.admin1_name ?? "",
      population:  r.population,
      latitude:    r.latitude,
      longitude:   r.longitude,
      ianaTz:      r.iana_tz,
      score:       r.score,
    }));
  }

  await cacheSet(cacheKey, rows, 3600);
  return rows;
}

/**
 * Récupère une ville par son geonameid.
 */
export async function getCityById(geonameid: number): Promise<CitySearchResult | null> {
  const result = await db.execute<{
    geonameid: number; name: string; ascii_name: string;
    country_code: string; admin1_code: string; admin1_name: string;
    population: number; latitude: number; longitude: number; iana_tz: string;
  }>(sql`
    SELECT geonameid, name, ascii_name, country_code,
           admin1_code, admin1_name,
           population, latitude, longitude, iana_tz
    FROM cities
    WHERE geonameid = ${geonameid}
    LIMIT 1
  `);
  const r = result.rows[0];
  if (!r) return null;
  return {
    geonameid:   r.geonameid,
    name:        r.name,
    asciiName:   r.ascii_name,
    countryCode: r.country_code,
    admin1Code:  r.admin1_code ?? "",
    admin1Name:  r.admin1_name ?? "",
    population:  r.population,
    latitude:    r.latitude,
    longitude:   r.longitude,
    ianaTz:      r.iana_tz,
    score:       1.0,
  };
}
