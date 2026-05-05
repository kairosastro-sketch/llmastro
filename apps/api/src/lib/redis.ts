// apps/api/src/lib/redis.ts
//
// CI-DEBT-PURGE-V1-G : stub permettant à TypeScript de résoudre l'import
// dynamique fait par redis-entitlements.ts (line 30) :
//
//     const mod = await import(/* @vite-ignore */ "../lib/redis.js");
//     redisClient = (mod.redis ?? mod.default ?? null) as RedisLike | null;
//
// Avant V1-G : le fichier n'existait pas, l'import dynamique throw au runtime,
// le try/catch dans loadRedis() catche et retourne null → no-op.
// TypeScript en revanche signalait l'import absent en TS2307.
//
// Avec V1-G : le fichier existe (ce stub), TypeScript résout l'import.
// Comme on n'exporte ni `redis` ni `default`, le runtime obtient
// `mod.redis === undefined` et `mod.default === undefined`, l'opérateur
// nullish ?? tombe sur null → no-op (comportement identique).
//
// Pour activer un vrai cache Redis pour les entitlements, remplacer ce
// fichier par une initialisation client (top-level await OK avec
// module=ESNext + target=ES2022) :
//
//     import { createClient } from "redis";
//     const _client = createClient({
//       url: process.env["REDIS_URL"] ?? "redis://redis:6379",
//     });
//     _client.on("error", () => { /* silent */ });
//     await _client.connect();
//     export const redis = _client;
//
// Les callers de redis-entitlements.ts s'en empareront automatiquement.

export {};
