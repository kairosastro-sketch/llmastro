// apps/api/src/lib/redis.ts
//
// CI-DEBT-PURGE-V1-G + V1-H : stub permettant à TypeScript de résoudre
// l'import dynamique de redis-entitlements.ts (line 30) :
//
//     const mod = await import(/* @vite-ignore */ "../lib/redis.js");
//     redisClient = (mod.redis ?? mod.default ?? null) as RedisLike | null;
//
// Évolution :
//
// V1-G : `export {}` → résolvait TS2307 mais déclenchait TS2339
//        (mod.redis et mod.default introuvables dans un module vide).
// V1-H : exports explicites `null` → mod.redis et mod.default existent
//        (typés `null`), runtime fait `null ?? null ?? null` = null →
//        loadRedis() retourne null → no-op (comportement identique au
//        pré-V1-G puisque le try/catch interceptait déjà l'absence).
//
// Pour activer un vrai cache Redis pour les entitlements plus tard,
// remplacer ce fichier par une initialisation client (top-level await
// OK avec module=ESNext + target=ES2022) :
//
//     import { createClient } from "redis";
//     const _client = createClient({
//       url: process.env["REDIS_URL"] ?? "redis://redis:6379",
//     });
//     _client.on("error", () => { /* silent */ });
//     await _client.connect();
//     export const redis = _client;
//     export default _client;
//
// Les callers de redis-entitlements.ts s'en empareront automatiquement.

export const redis = null;
export default null;
