// ============================================================
// apps/api/src/services/readings.service.ts
// ------------------------------------------------------------
// ARCHIVE-PERSISTENCE-LECTURES-IA-V1
// Service de persistance des lectures Kairos.
//
// Read path (cache-aside) :
//   1. Redis GET (TTL 1h)
//      - HIT version OK → return
//      - HIT version obsolète → DROP, suit le miss path
//   2. Postgres SELECT
//      - HIT version OK → warm Redis, return
//      - HIT version obsolète + autoRegen activé → call generator,
//        UPDATE row, warm Redis, return
//      - MISS → call generator, INSERT row, warm Redis, return
//
// Race-condition INSERT : UNIQUE (user_id, kind, reading_key)
// → en cas de conflit (2e thread plus rapide), on retry SELECT.
// ============================================================

import type { PoolClient } from "pg";
import { pool } from "../db/index.js";
import {
  shouldAutoRegen,
  getCurrentVersion,
  type PromptKind,
} from "./ai-prompts.versions.js";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export interface Reading {
  id: string;
  userId: string;
  natalProfileId: string | null;
  kind: PromptKind;
  readingKey: string;
  content: unknown;
  promptVersion: number;
  model: string;
  generatedAt: Date;
  regeneratedAt: Date | null;
  regenCount: number;
}

export interface GeneratorResult {
  content: unknown;
  model: string;
}

export interface GetOrGenerateArgs {
  userId: string;
  kind: PromptKind;
  readingKey: string;
  natalProfileId?: string | null;
  generator: () => Promise<GeneratorResult>;
}

// ------------------------------------------------------------
// Cache Redis (gracieux : reuse du pattern existant dans routes/ai.ts)
// ------------------------------------------------------------
const REDIS_TTL_SECONDS = 3600; // 1h

let _redis: any = null;
async function getRedis() {
  if (_redis !== null) return _redis;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: process.env["REDIS_URL"] ?? "redis://redis:6379" });
    client.on("error", () => { /* silent */ });
    await client.connect();
    _redis = client;
    return _redis;
  } catch {
    _redis = false; // marqueur d'échec, on ne retentera pas
    return null;
  }
}

function cacheKey(userId: string, kind: PromptKind, readingKey: string): string {
  return `astro:reading:${userId}:${kind}:${readingKey}`;
}

async function readCache(userId: string, kind: PromptKind, readingKey: string): Promise<Reading | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(cacheKey(userId, kind, readingKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Réhydratation des dates
    parsed.generatedAt = new Date(parsed.generatedAt);
    parsed.regeneratedAt = parsed.regeneratedAt ? new Date(parsed.regeneratedAt) : null;
    return parsed as Reading;
  } catch {
    return null;
  }
}

async function writeCache(reading: Reading): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.setEx(
      cacheKey(reading.userId, reading.kind, reading.readingKey),
      REDIS_TTL_SECONDS,
      JSON.stringify(reading),
    );
  } catch { /* silent */ }
}

async function dropCache(userId: string, kind: PromptKind, readingKey: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.del(cacheKey(userId, kind, readingKey));
  } catch { /* silent */ }
}

// ------------------------------------------------------------
// Mapping ligne SQL → Reading
// HOTFIX-GROK-RETRY-V1 : `generated_at` / `regenerated_at` peuvent
// remonter en `string` selon le driver pg — on garantit ici le contrat
// du type `Reading` (dates = `Date`) pour que `.toISOString()` côté
// route ne plante pas sur le chemin « fraîche lecture DB ».
// ------------------------------------------------------------
function rowToReading(row: any): Reading {
  return {
    id: row.id,
    userId: row.user_id,
    natalProfileId: row.natal_profile_id ?? null,
    kind: row.kind as PromptKind,
    readingKey: row.reading_key,
    content: row.content,
    promptVersion: row.prompt_version,
    model: row.model,
    generatedAt: new Date(row.generated_at),
    regeneratedAt: row.regenerated_at ? new Date(row.regenerated_at) : null,
    regenCount: row.regen_count,
  };
}

// ------------------------------------------------------------
// DB helpers (PoolClient pour transactionnel possible)
// ------------------------------------------------------------
async function dbSelect(
  client: PoolClient | typeof pool,
  userId: string,
  kind: PromptKind,
  readingKey: string,
): Promise<Reading | null> {
  const res = await client.query(
    `SELECT * FROM ai_readings
     WHERE user_id = $1 AND kind = $2 AND reading_key = $3
     LIMIT 1`,
    [userId, kind, readingKey],
  );
  if (res.rowCount === 0) return null;
  return rowToReading(res.rows[0]);
}

async function dbInsert(
  client: PoolClient | typeof pool,
  args: {
    userId: string;
    kind: PromptKind;
    readingKey: string;
    natalProfileId: string | null;
    content: unknown;
    promptVersion: number;
    model: string;
  },
): Promise<Reading> {
  const res = await client.query(
    `INSERT INTO ai_readings
       (user_id, natal_profile_id, kind, reading_key, content, prompt_version, model)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      args.userId,
      args.natalProfileId,
      args.kind,
      args.readingKey,
      JSON.stringify(args.content),
      args.promptVersion,
      args.model,
    ],
  );
  return rowToReading(res.rows[0]);
}

async function dbUpdateForRegen(
  client: PoolClient | typeof pool,
  args: {
    id: string;
    content: unknown;
    promptVersion: number;
    model: string;
  },
): Promise<Reading> {
  const res = await client.query(
    `UPDATE ai_readings
       SET content = $1,
           prompt_version = $2,
           model = $3,
           regenerated_at = NOW(),
           regen_count = regen_count + 1
     WHERE id = $4
     RETURNING *`,
    [JSON.stringify(args.content), args.promptVersion, args.model, args.id],
  );
  if (res.rowCount === 0) {
    throw new Error(`Reading ${args.id} not found for update`);
  }
  return rowToReading(res.rows[0]);
}

// ------------------------------------------------------------
// API publique
// ------------------------------------------------------------

/**
 * Récupère une lecture, en la générant si nécessaire ou si sa version
 * est obsolète (sauf pour les kinds qui ont auto-regen désactivé).
 */
export async function getOrGenerate(args: GetOrGenerateArgs): Promise<Reading> {
  const { userId, kind, readingKey, natalProfileId = null, generator } = args;
  const currentVersion = getCurrentVersion(kind);
  const autoRegenActive = shouldAutoRegen(kind);

  // 1. Cache Redis
  const cached = await readCache(userId, kind, readingKey);
  if (cached) {
    if (!autoRegenActive || cached.promptVersion >= currentVersion) {
      return cached;
    }
    // version obsolète : on drop et on suit le miss path
    await dropCache(userId, kind, readingKey);
  }

  // 2. Postgres
  const existing = await dbSelect(pool, userId, kind, readingKey);

  if (existing) {
    if (!autoRegenActive || existing.promptVersion >= currentVersion) {
      // À jour : warm cache et return
      await writeCache(existing);
      return existing;
    }
    // Obsolète : regen
    const result = await generator();
    const updated = await dbUpdateForRegen(pool, {
      id: existing.id,
      content: result.content,
      promptVersion: currentVersion,
      model: result.model,
    });
    await writeCache(updated);
    return updated;
  }

  // 3. MISS DB → INSERT (avec gestion race condition)
  const result = await generator();
  try {
    const inserted = await dbInsert(pool, {
      userId,
      kind,
      readingKey,
      natalProfileId,
      content: result.content,
      promptVersion: currentVersion,
      model: result.model,
    });
    await writeCache(inserted);
    return inserted;
  } catch (err: any) {
    // Code Postgres 23505 = unique_violation (un autre thread a inséré entre-temps)
    if (err?.code === "23505") {
      const concurrent = await dbSelect(pool, userId, kind, readingKey);
      if (concurrent) {
        await writeCache(concurrent);
        return concurrent;
      }
    }
    throw err;
  }
}

/**
 * Régénère une lecture par son ID (utilisé par l'endpoint admin).
 * Force la regen même si la version est à jour.
 */
export async function regenerateById(args: {
  readingId: string;
  generator: () => Promise<GeneratorResult>;
}): Promise<Reading> {
  // Lookup
  const res = await pool.query(
    `SELECT * FROM ai_readings WHERE id = $1 LIMIT 1`,
    [args.readingId],
  );
  if (res.rowCount === 0) {
    throw new Error(`Reading not found: ${args.readingId}`);
  }
  const reading = rowToReading(res.rows[0]);

  const result = await args.generator();
  const currentVersion = getCurrentVersion(reading.kind);
  const updated = await dbUpdateForRegen(pool, {
    id: reading.id,
    content: result.content,
    promptVersion: currentVersion,
    model: result.model,
  });
  await dropCache(updated.userId, updated.kind, updated.readingKey);
  await writeCache(updated);
  return updated;
}
