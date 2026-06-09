// ============================================================
// setup.ts — Setup global des tests vitest (REDIS-TEST-CLEANUP-V1)
// ------------------------------------------------------------
// Exécuté dans CHAQUE worker de test (setupFiles). Enregistre un
// afterAll qui ferme la connexion Redis éventuellement ouverte par
// `ephemerisService` (via service.ts). Sans ça, quand REDIS_URL est
// joignable (service `redis` du job CI), le socket reste ouvert et
// empêche le process de tests de se terminer → la CI se bloque.
// No-op si aucune connexion n'a été établie (ex. en local).
// ============================================================

import { afterAll } from "vitest";
import { disconnectRedis } from "../src/service.js";

afterAll(async () => {
  await disconnectRedis();
});
