import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // REDIS-TEST-CLEANUP-V1 : Redis est un cache transparent — aucun test
    // n'en dépend (un miss recalcule, même résultat). On le DÉSACTIVE
    // complètement (aucun client créé) pour garantir que le process de tests
    // se termine : en CI le job fournit un vrai service redis, et même une
    // connexion forcée en échec (ECONNREFUSED) laisse un handle ouvert qui
    // bloquait vitest. Le flag empêche la création même du client.
    // Filet : tests/setup.ts ferme aussi toute connexion éventuelle.
    env: { EPHEMERIS_DISABLE_REDIS: "1" },
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
});
