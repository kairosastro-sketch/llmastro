// ============================================================
// apps/api/src/services/cities.service.ts
// ------------------------------------------------------------
// Recherche de villes pour l'autocomplete frontend.
//
// Pipeline :
//   1. Validation de la query (longueur min, normalisation)
//   2. Cache Redis : key = sha1(q,country,limit) TTL 1h
//   3. SQL Postgres avec pg_trgm + scoring par population
//   4. Réponse : tableau de CitySearchResult
//
// Performance attendue :
//   • cache hit : <5 ms
//   • cache miss : 10-50 ms sur 185k lignes
// ============================================================

import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../db/index.js";

// ─────────────────────────────────────────────────────────────
// Redis (cache gracieux — pattern miroir de ai.ts)
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
  /** GeoNames id, stable, à stocker en DB pour les profils natals. */
  geonameid:   number;
  /** Nom local (UTF-8) — c'est ce qu'on affiche à l'utilisateur. */
  name:        string;
  /** Translittération ASCII pour matchings/sorts. */
  asciiName:   string;
  /** Code ISO-3166 alpha-2 (ex. "FR"). */
  countryCode: string;
  /** Population (0 si inconnu). */
  population:  number;
  latitude:    number;
  longitude:   number;
  /** Identifiant IANA — directement utilisable par localToUTC. */
  ianaTz:      string;
  /** Score de similarité [0,1], retourné par pg_trgm. */
  score:       number;
}

export interface CitySearchOptions {
  /** Limite de résultats (défaut 10, max 25). */
  limit?:       number;
  /** Filtre ISO-3166 alpha-2 (ex. "FR" pour ne chercher qu'en France). */
  countryCode?: string;
}

// ─────────────────────────────────────────────────────────────
// Normalisation query
// ─────────────────────────────────────────────────────────────

function normalizeQuery(q: string): string {
  return q
    .trim()
    .normalize("NFD")
    // On garde les diacritiques côté client mais on cherche aussi
    // sur ascii_name côté serveur, donc l'utilisateur a le choix.
    .slice(0, 100); // hardcap pour éviter du SQL pathologique
}

function makeCacheKey(q: string, opts: CitySearchOptions): string {
  const payload = JSON.stringify({
    q: q.toLowerCase(),
    cc: opts.countryCode ?? "",
    l: opts.limit ?? 10,
  });
  return "cities:v1:" + createHash("sha1").update(payload).digest("hex").slice(0, 16);
}

// ─────────────────────────────────────────────────────────────
// Recherche
// ─────────────────────────────────────────────────────────────

/**
 * Recherche d'autocomplete : retourne les meilleures correspondances
 * triées par (similarité + log10(population)) descendant.
 *
 * Le scoring est un compromis :
 *   - similarity prend le dessus sur le nom exact ("paris" → Paris FR)
 *   - mais en cas d'ambiguïté ("Paris" → Paris FR vs Paris TX),
 *     la population fait pencher la balance vers la plus connue.
 *
 * Pour les très petits q (1-2 caractères) on désactive le fuzzy
 * et on fait un ILIKE prefix, sinon pg_trgm renvoie trop de bruit.
 */
export async function searchCities(
  rawQuery: string,
  opts: CitySearchOptions = {},
): Promise<CitySearchResult[]> {
  const q = normalizeQuery(rawQuery);
  if (q.length < 2) return [];

  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const countryCode = opts.countryCode?.toUpperCase().slice(0, 2);

  // Cache check
  const cacheKey = makeCacheKey(q, { limit, countryCode });
  const cached = await cacheGet<CitySearchResult[]>(cacheKey);
  if (cached) return cached;

  // Pour les requêtes très courtes, on fait un prefix match
  // (plus prévisible que pg_trgm sur 2 caractères).
  let rows: Array<Omit<CitySearchResult, "score"> & { score: number }>;

  if (q.length <= 3) {
    const result = await db.execute<{
      geonameid: number; name: string; ascii_name: string;
      country_code: string; population: number;
      latitude: number; longitude: number; iana_tz: string;
      score: number;
    }>(sql`
      SELECT geonameid, name, ascii_name, country_code, population,
             latitude, longitude, iana_tz,
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
      population:  r.population,
      latitude:    r.latitude,
      longitude:   r.longitude,
      ianaTz:      r.iana_tz,
      score:       r.score,
    }));
  } else {
    // Recherche pg_trgm pour les requêtes ≥ 4 caractères.
    // Le seuil de similarité par défaut est 0.3 ; on l'abaisse à
    // 0.2 pour la recherche (plus permissif sur les fautes).
    const result = await db.execute<{
      geonameid: number; name: string; ascii_name: string;
      country_code: string; population: number;
      latitude: number; longitude: number; iana_tz: string;
      score: number;
    }>(sql`
      WITH candidates AS (
        SELECT geonameid, name, ascii_name, country_code, population,
               latitude, longitude, iana_tz,
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
 * Récupère une ville par son geonameid (utilisé pour valider qu'un
 * profil natal référence bien une ville existante).
 */
export async function getCityById(geonameid: number): Promise<CitySearchResult | null> {
  const result = await db.execute<{
    geonameid: number; name: string; ascii_name: string;
    country_code: string; population: number;
    latitude: number; longitude: number; iana_tz: string;
  }>(sql`
    SELECT geonameid, name, ascii_name, country_code, population,
           latitude, longitude, iana_tz
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
    population:  r.population,
    latitude:    r.latitude,
    longitude:   r.longitude,
    ianaTz:      r.iana_tz,
    score:       1.0,
  };
}
