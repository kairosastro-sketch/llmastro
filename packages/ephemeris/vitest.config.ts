import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // REDIS-TEST-CLEANUP-V1 : Redis est un cache transparent — aucun test
    // n'en dépend (un miss recalcule, même résultat). On le rend INJOIGNABLE
    // pendant les tests : `getRedis()` échoue (ECONNREFUSED) → `_redis=false`,
    // aucun socket ouvert → vitest se termine proprement. C'est ce qui se
    // passe déjà en local ; on force le même comportement en CI (où le job
    // fournit un vrai service redis sur localhost:6379, dont la connexion
    // restée ouverte bloquait le process). Filet de sécurité : tests/setup.ts
    // ferme aussi toute connexion éventuelle en afterAll.
    env: { REDIS_URL: "redis://127.0.0.1:1" },
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
});
