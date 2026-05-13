import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { authRoutes }       from "./routes/auth.js";
import { natalRoutes }      from "./routes/natal.js";
import { ephemerisRoutes }  from "./routes/ephemeris.js";
import { publicEphemerisRoutes } from "./routes/public-ephemeris.js";
import { publicSkyRoutes } from "./routes/public-sky.js";
import { horoscopeRoutes }  from "./routes/horoscope.js";
import { transitsRoutes } from "./routes/transits.js";
import { aiRoutes } from "./routes/ai.js";
import { chatRoutes } from "./routes/chat.js";
import { compatRoutes }  from "./routes/compat.js";
import { healthRoutes }     from "./routes/health.js";
import { citiesRoutes } from "./routes/cities.js";
import { initCities } from "./boot/init-cities.js";
import { searchCities } from "./services/cities.service.js";
import { ephemerisService } from "@astro-platform/ephemeris";
import { initSchemaCoherence } from "./boot/init-schema-coherence.js";
import { initChat } from "./boot/init-chat.js";
import { startTokenCleanup } from "./boot/cleanup-tokens.js";
import { startSkyPublication } from "./boot/init-sky.js";
import { ensureNotificationsSchema, normalizeDedupKeysToDay, backfillBilingualKairosText, startNotificationDispatcher, startDailyHoroscopeScheduler } from "./boot/init-notifications.js";
import { neo4jService }     from "@astro-platform/neo4j";
import { runMigrations, pool } from "./db/index.js";
import adminRoutes from "./routes/admin.js";
import adminPanelRoutes from "./routes/admin-panel.js";
import { initAdminFlag } from "./boot/init-admin-flag.js";
import { initStatsTables } from "./boot/init-stats-tables.js";
import { initReadings } from "./boot/init-readings.js";
import { subscriptionsRoutes } from "./routes/subscriptions.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { bootTiers } from "./boot/seed-plans.js";
import { cleanupPaywallV3 } from "./boot/cleanup-paywall-v3.js";

// ─────────────────────────────────────────────────────────────
// Fail-fast helpers : empêche le démarrage avec des secrets
// manquants ou trop faibles. Plus de fallback "dev-secret-change-me".
// ─────────────────────────────────────────────────────────────

function requireSecret(name: string, minLength = 32): string {
  const v = process.env[name];
  if (!v || v.trim().length < minLength) {
    // eslint-disable-next-line no-console
    console.error(`❌ FATAL: ${name} is missing or too short (min ${minLength} chars).`);
    // eslint-disable-next-line no-console
    console.error(`   Set it in .env.local before starting the API.`);
    process.exit(1);
  }
  return v.trim();
}

function parseCorsOrigins(): string[] {
  const raw = process.env["BACKEND_CORS_ORIGIN"]
    ?? process.env["APP_URL"]
    ?? "http://localhost:3000";
  const list = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (list.length === 0) {
    // eslint-disable-next-line no-console
    console.error(`❌ FATAL: BACKEND_CORS_ORIGIN is empty.`);
    process.exit(1);
  }
  return list;
}

export async function buildApp() {
  // Validate critical secrets BEFORE registering anything
  const jwtSecret        = requireSecret("JWT_SECRET", 32);
  const jwtRefreshSecret = requireSecret("JWT_REFRESH_SECRET", 32);
  const corsOrigins      = parseCorsOrigins();

  const app = Fastify({
    logger: { level: process.env["LOG_LEVEL"] ?? "info" },
    trustProxy: true,
    ajv: { customOptions: { allErrors: true, removeAdditional: true } },
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  // EPHEMERIS-DEEP-CONSOLIDATION-V1 : injection du cityResolver
  // dans le service ephemeris. Le package est ainsi 100% indépendant
  // de toute liste hardcodée de villes — on lui donne le lookup
  // via la table Postgres "cities" (185k entries GeoNames).
  ephemerisService.setCityResolver(async (name: string) => {
    const matches = await searchCities(name, { limit: 1 });
    if (matches.length === 0) return null;
    const m = matches[0]!;
    return { lat: m.latitude, lng: m.longitude, ianaTz: m.ianaTz };
  });
  app.log.info("[ephemeris] City resolver injected (Postgres cities table)");

  // CORS strict : whitelist explicite. Plus de regex IP.
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Rate limit global. Les routes peuvent surcharger via `config: { rateLimit: ... }`.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    enableDraftSpec: true,
  });

  await app.register(jwt, {
    secret: jwtSecret,
    sign: { expiresIn: process.env["JWT_ACCESS_EXPIRES_IN"] ?? "15m" },
    cookie: { cookieName: "refreshToken", signed: false },
  });

  await app.register(cookie, {
    secret: jwtRefreshSecret,
  });

  await app.register(swagger, {
    openapi: {
      info: { title: "Astro Platform API", description: "Astrology API", version: "3.0.0" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });

  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(healthRoutes,    { prefix: "/health" });
  await app.register(citiesRoutes,    { prefix: "/cities" });
  await app.register(authRoutes,      { prefix: "/auth" });
  await app.register(subscriptionsRoutes, { prefix: "/subscriptions" });
  await app.register(natalRoutes,     { prefix: "/natal" });
  await app.register(ephemerisRoutes, { prefix: "/ephemeris" });
  await app.register(publicEphemerisRoutes, { prefix: "/public/ephemeris" });
  await app.register(publicSkyRoutes, { prefix: "/public/sky" });
  await app.register(horoscopeRoutes, { prefix: "/horoscope" });
  await app.register(transitsRoutes, { prefix: "/transits" });
  await app.register(aiRoutes,       { prefix: "/ai" });
  await app.register(chatRoutes,     { prefix: "/chat" }); // CHAT-PERSISTENCE-V1-DATA registered
  await app.register(compatRoutes,   { prefix: "/compat" });
  await app.register(adminRoutes,    { prefix: "/admin" });
  await app.register(adminPanelRoutes, { prefix: "/admin-panel" });
  await app.register(notificationsRoutes, { prefix: "/notifications" });

  const shutdown = async () => {
    await neo4jService.close();
    await pool.end();
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);

  return app;
}

async function main() {
  const app = await buildApp();
  try {
    await runMigrations();
    await initSchemaCoherence();
    await initAdminFlag();
    await initStatsTables();
    await initReadings();
    await initCities();
    await initChat();
    await ensureNotificationsSchema();
    const dedupNorm = await normalizeDedupKeysToDay();
    if (dedupNorm.deletedDuplicates > 0 || dedupNorm.truncatedKeys > 0) {
      app.log.info(dedupNorm, "[init-notifications] dedup keys normalized to YYYY-MM-DD");
    }
    // Backfill bilingue des rows legacy (kairosText: string → {fr, en}).
    // Idempotent : ne fait rien si toutes les rows sont déjà au format objet.
    // Async fire-and-forget pour ne pas bloquer le boot (peut prendre quelques
    // secondes avec N appels LLM).
    void backfillBilingualKairosText(app.log).then((bilingual) => {
      if (bilingual.skipped) return;
      if (bilingual.scanned > 0) {
        app.log.info(bilingual, "[init-notifications] bilingual kairosText backfill completed");
      }
    }).catch((err) => {
      app.log.error({ err }, "[init-notifications] bilingual backfill failed (full catch)");
    });
    startTokenCleanup(app.log);
    startSkyPublication(app.log);
    startNotificationDispatcher(app.log);
    startDailyHoroscopeScheduler(app.log);
  } catch (err) {
    app.log.error({ err }, "Database migration failed");
    process.exit(1);
  }
  try {
    await neo4jService.verifyConnectivity();
    await neo4jService.initSchema();
    await neo4jService.seedReferenceData();
  } catch (err) {
    app.log.warn({ err }, "Neo4j init warning — continuing");
  }
  const port = parseInt(process.env["PORT"] ?? "4000", 10);
  const host = process.env["HOST"] ?? "0.0.0.0";
  await bootTiers();
  // PAYWALL-V3 : purge des usage_counters orphelins post-PR #37.
  // Idempotent — no-op après le premier boot.
  await cleanupPaywallV3();
  await app.listen({ port, host });
  app.log.info(`🚀 API ready at http://${host}:${port}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// ARCHIVE-LANDING-EPHEMERIDES-V2 applied

// ARCHIVE-SCHEMA-COHERENCE-V1 applied

// EPHEMERIS-DEEP-CONSOLIDATION-V1 applied

// ADMIN-FOUNDATION-V1-BACKEND applied

// ADMIN-STATS-V1-BACKEND applied

// CIEL-PUBLIC-V1-DATA-POSITIONS index applied
