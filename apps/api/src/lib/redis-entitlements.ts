// ARCHIVE-3-TIERS-V1
// Cache Redis des entitlements résolus par user.
// Pattern : key `entitlements:user:{userId}` = JSON string, TTL 1h.
//
// Le client Redis est supposé disponible globalement (déjà utilisé ailleurs
// dans l'app pour le cache ephemeris). Si le fichier ../lib/redis.ts n'existe
// pas encore dans ta codebase, un fallback silencieux désactive le cache.

import type { EntitlementsMap } from "@astro-platform/types";

// ----------------------------------------------------------
// Import du client Redis — tolérant à l'absence du fichier
// ----------------------------------------------------------
// On essaie d'abord une import standard. Si le fichier n'existe pas,
// on expose un shim no-op pour que le reste du code continue de marcher
// (fallback : tout est résolu depuis Postgres, un peu plus lent).
type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<unknown>;
  setex?(key: string, ttl: number, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
};

let redisClient: RedisLike | null = null;

async function loadRedis(): Promise<RedisLike | null> {
  if (redisClient) return redisClient;
  try {
    // Import dynamique : si le module n'existe pas on catch et on no-op.
    const mod = await import(/* @vite-ignore */ "../lib/redis.js");
    redisClient = (mod.redis ?? mod.default ?? null) as RedisLike | null;
    return redisClient;
  } catch {
    // Pas de Redis → fallback no-op.
    return null;
  }
}

// ----------------------------------------------------------
// TTL
// ----------------------------------------------------------
const TTL_SECONDS = 60 * 60; // 1 heure

// ----------------------------------------------------------
// Keys
// ----------------------------------------------------------
export function entitlementsCacheKey(userId: string): string {
  return `entitlements:user:${userId}`;
}

// ----------------------------------------------------------
// API
// ----------------------------------------------------------
export async function getCachedEntitlements(
  userId: string
): Promise<EntitlementsMap | null> {
  const redis = await loadRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(entitlementsCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as EntitlementsMap;
  } catch {
    return null;
  }
}

export async function setCachedEntitlements(
  userId: string,
  data: EntitlementsMap
): Promise<void> {
  const redis = await loadRedis();
  if (!redis) return;

  try {
    const key   = entitlementsCacheKey(userId);
    const value = JSON.stringify(data);
    // Compat ioredis (setex) et node-redis (set avec EX).
    if (redis.setex) {
      await redis.setex(key, TTL_SECONDS, value);
    } else {
      await redis.set(key, value, "EX", TTL_SECONDS);
    }
  } catch {
    // cache silencieux
  }
}

export async function invalidateEntitlements(userId: string): Promise<void> {
  const redis = await loadRedis();
  if (!redis) return;

  try {
    await redis.del(entitlementsCacheKey(userId));
  } catch {
    // ignore
  }
}

/**
 * À appeler dès qu'un changement affecte les droits d'un user :
 * - changement de plan
 * - nouvel override
 * - nouveau grant
 * - fin de trial
 */
export async function invalidateUserTiersCache(userId: string): Promise<void> {
  await invalidateEntitlements(userId);
}
