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
import { partnerRoutes } from "./routes/partner.js"; // GENERIC-HOROSCOPES-V1
import { horoscopeRoutes }  from "./routes/horoscope.js";
import { transitsRoutes } from "./routes/transits.js";
import { aiRoutes } from "./routes/ai.js";
import { chatRoutes } from "./routes/chat.js";
import { tarotRoutes } from "./routes/tarot.js";
import { compatRoutes }  from "./routes/compat.js";
import { healthRoutes }     from "./routes/health.js";
import { citiesRoutes } from "./routes/cities.js";
import { initCities } from "./boot/init-cities.js";
import { searchCities } from "./services/cities.service.js";
import { ephemerisService, getActiveEngine } from "@astro-platform/ephemeris";
import { initSchemaCoherence } from "./boot/init-schema-coherence.js";
import { initChat } from "./boot/init-chat.js";
import { initTarot } from "./boot/init-tarot.js";
import { startTokenCleanup } from "./boot/cleanup-tokens.js";
import { initEmailVerification } from "./boot/init-email-verification.js";
import { initPasswordReset } from "./boot/init-password-reset.js";
import { initSkyTables, startSkyPublication } from "./boot/init-sky.js";
import { startGenericHoroscopes, initGenericHoroscopeTables } from "./boot/init-generic-horoscopes.js"; // GENERIC-HOROSCOPES-V1
import { ensureNotificationsSchema, normalizeDedupKeysToDay, backfillBilingualKairosText, startNotificationDispatcher, startDailyHoroscopeScheduler } from "./boot/init-notifications.js";
import { initGrowth } from "./boot/init-growth.js";
import { initPromoCodes } from "./boot/init-promo-codes.js";
import { runMigrations, pool } from "./db/index.js";
import adminRoutes from "./routes/admin.js";
import adminPanelRoutes from "./routes/admin-panel.js";
import adminHoroscopesRoutes from "./routes/admin-horoscopes.js"; // GENERIC-HOROSCOPES-V1
import { initAdminFlag } from "./boot/init-admin-flag.js";
import { initStatsTables } from "./boot/init-stats-tables.js";
import { initAnalyticsTables } from "./boot/init-analytics-tables.js"; // ANALYTICS-V1
import { analyticsRoutes } from "./routes/analytics.js"; // ANALYTICS-V1
import { initReadings } from "./boot/init-readings.js";
import { subscriptionsRoutes } from "./routes/subscriptions.js";
import { stripeWebhookRoutes } from "./routes/stripe-webhook.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { growthRoutes } from "./routes/growth.js";
import { promoCodesRoutes } from "./routes/promo-codes.js";
import communityRoutes from "./routes/community.js";
import { contactRoutes } from "./routes/contact.js";
import { initCommunity } from "./boot/init-community.js";
import { initRelationships } from "./boot/init-relationships.js";
import { initNatalEncryption } from "./boot/init-natal-encryption.js"; // ENCRYPT-NATAL-V1
import { bootTiers } from "./boot/seed-plans.js";
import { cleanupPaywallV3 } from "./boot/cleanup-paywall-v3.js";
import { startDbWatchdog } from "./boot/init-db-watchdog.js"; // SECURITY-DB-WATCHDOG-V1

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

// ─────────────────────────────────────────────────────────────
// SECURITY-SAFE-DEFAULTS-V1 — refuse de démarrer en production avec
// le bypass de paiement /subscriptions/dev/set-plan actif.
// DEV_PLAN_SWITCH=true permet à tout user authentifié de se mettre
// premium sans payer ; ça ne doit jamais tourner en prod. La CI
// (fresh-db-test) teste pourtant les gates via cet endpoint sur l'image
// de prod (NODE_ENV=production), d'où l'échappatoire explicite
// ALLOW_DEV_PLAN_SWITCH=true, posée uniquement par le harnais CI.
// ─────────────────────────────────────────────────────────────
function assertSafeProductionFlags(): void {
  const isProd       = process.env["NODE_ENV"] === "production";
  const devSwitch    = process.env["DEV_PLAN_SWITCH"] === "true";
  const ciOverride   = process.env["ALLOW_DEV_PLAN_SWITCH"] === "true";
  if (isProd && devSwitch && !ciOverride) {
    // eslint-disable-next-line no-console
    console.error(
      "❌ FATAL: DEV_PLAN_SWITCH=true with NODE_ENV=production. " +
      "This exposes POST /subscriptions/dev/set-plan (free self-upgrade to any plan). " +
      "Set DEV_PLAN_SWITCH=false in your prod .env.local before starting the API."
    );
    process.exit(1);
  }
}

export async function buildApp() {
  // Validate critical secrets BEFORE registering anything
  const jwtSecret        = requireSecret("JWT_SECRET", 32);
  const jwtRefreshSecret = requireSecret("JWT_REFRESH_SECRET", 32);
  // ENCRYPT-NATAL-V1 — clé de chiffrement des données natales. Fail-fast ici
  // pour ne jamais démarrer (ni migrer) sans elle. ⚠️ La perdre = perte
  // définitive des données chiffrées : à sauvegarder hors backups DB.
  requireSecret("DATA_ENCRYPTION_KEY", 32);
  const corsOrigins      = parseCorsOrigins();
  assertSafeProductionFlags();

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

  // ASTRO-NO-SILENT-FALLBACK-V1 : résout le moteur astro tôt (fail-fast).
  // En production, si swisseph ne charge pas et qu'aucun opt-in
  // ASTRO_ALLOW_FALLBACK=true n'est posé, getActiveEngine() throw ici plutôt
  // que de laisser AstraCore (sans ΔT) servir des thèmes faux à la 1re requête.
  const astroEngine = getActiveEngine();
  app.log.info({ engine: astroEngine }, "[ephemeris] active calculation engine resolved");

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

  // ─────────────────────────────────────────────────────────
  // PLAN-FRESHNESS-V1 — no-store sur les réponses API dynamiques.
  // Les données authentifiées (plan, entitlements, horoscopes…) ne doivent
  // JAMAIS être servies depuis le cache HTTP du navigateur : sinon un
  // changement de plan (upgrade, fin de trial) reste invisible jusqu'au vidage
  // du cache (bug constaté : /auth/me périmé, corrigé uniquement en navigation
  // privée). On force Cache-Control: no-store partout SAUF /public/* (cacheable
  // pour l'ISR/CDN) et les routes qui posent déjà leur propre Cache-Control.
  // ─────────────────────────────────────────────────────────
  app.addHook("onSend", async (request, reply, payload) => {
    if (!request.url.startsWith("/public/") && !reply.getHeader("cache-control")) {
      reply.header("Cache-Control", "no-store");
    }
    return payload;
  });

  // ─────────────────────────────────────────────────────────
  // ERROR-SHAPE-V1
  // Normalise toutes les erreurs vers { success: false, error: { code, message, details } }.
  // Sans ça, FST_ERR_VALIDATION et les autres FastifyError étaient renvoyés au
  // format Fastify par défaut ({ statusCode, error, message }), que apiClient
  // côté web parse mal (lit `json.error.message` alors que `json.error` est une
  // string), ce qui donne le banner générique "Une erreur est survenue" à
  // l'utilisateur même quand l'email est juste invalide.
  // ─────────────────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const validation = (error as { validation?: Array<{ instancePath?: string; message?: string; keyword?: string; params?: unknown }> }).validation;
    if (error.code === "FST_ERR_VALIDATION" || (validation && validation.length > 0)) {
      const first = validation?.[0];
      const field = first?.instancePath?.replace(/^\//, "") || "input";
      const reason = first?.message ?? error.message;
      request.log.warn({ err: error, validation }, "[error-handler] request validation failed");
      return reply.code(400).send({
        success: false,
        error: {
          code:    "VALIDATION_ERROR",
          message: `${field} ${reason}`,
          details: { field, reason, validation: validation ?? null },
        },
      });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, "[error-handler] internal error");
      return reply.code(500).send({
        success: false,
        error: { code: error.code ?? "INTERNAL_ERROR", message: "Internal server error" },
      });
    }

    return reply.code(statusCode).send({
      success: false,
      error: {
        code:    error.code ?? "ERROR",
        message: error.message ?? "Request failed",
      },
    });
  });

  await app.register(healthRoutes,    { prefix: "/health" });
  await app.register(citiesRoutes,    { prefix: "/cities" });
  await app.register(authRoutes,      { prefix: "/auth" });
  await app.register(subscriptionsRoutes, { prefix: "/subscriptions" });
  // STRIPE-MVP-V1 : webhook enregistré séparément pour scoper le raw-body
  // content-type parser à cette unique route (pas de prefix — l'URL finale
  // est /subscriptions/webhook).
  await app.register(stripeWebhookRoutes);
  await app.register(natalRoutes,     { prefix: "/natal" });
  await app.register(ephemerisRoutes, { prefix: "/ephemeris" });
  await app.register(publicEphemerisRoutes, { prefix: "/public/ephemeris" });
  await app.register(publicSkyRoutes, { prefix: "/public/sky" });
  await app.register(partnerRoutes,   { prefix: "/partner" }); // GENERIC-HOROSCOPES-V1
  await app.register(horoscopeRoutes, { prefix: "/horoscope" });
  await app.register(transitsRoutes, { prefix: "/transits" });
  await app.register(aiRoutes,       { prefix: "/ai" });
  await app.register(chatRoutes,     { prefix: "/chat" }); // CHAT-PERSISTENCE-V1-DATA registered
  await app.register(tarotRoutes,    { prefix: "/tarot" }); // TAROT-PERSISTENCE-V1 registered
  await app.register(compatRoutes,   { prefix: "/compat" });
  await app.register(adminRoutes,    { prefix: "/admin" });
  await app.register(adminPanelRoutes, { prefix: "/admin-panel" });
  await app.register(adminHoroscopesRoutes, { prefix: "/admin-panel/horoscopes" }); // GENERIC-HOROSCOPES-V1
  await app.register(analyticsRoutes, { prefix: "/analytics" }); // ANALYTICS-V1
  await app.register(notificationsRoutes, { prefix: "/notifications" });
  // [GROWTH-V1-CAPTURE] Pas de prefix unique : les routes parrainage
  // /referrals/* et affiliation /affiliate/* sont colocalisées par
  // domaine (growth) plutôt que par préfixe URL.
  await app.register(growthRoutes);
  await app.register(promoCodesRoutes, { prefix: "/promo-codes" });
  await app.register(communityRoutes, { prefix: "/community" });
  await app.register(contactRoutes, { prefix: "/contact" });

  const shutdown = async () => {
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
  // ─────────────────────────────────────────────────────────
  // BOOT-HARDENING-V1
  // Toute la DDL/seed bloquante (migrations + inits + bootTiers) s'exécute
  // d'abord, sur un pool pg CALME — une connexion à la fois. Les schedulers
  // de fond font un `void run()` immédiat au boot qui ouvre une connexion
  // PAR user ; démarrés trop tôt ils épuisaient les slots du pool, si bien
  // que maybeApplyMigration (bootTiers) ne pouvait plus acquérir de client
  // → "timeout exceeded when trying to connect" → crash transitoire au
  // boot/recreate. On déplace donc TOUT le fire-and-forget (backfill +
  // schedulers) APRÈS app.listen() : la migration ne les concurrence plus,
  // et l'app est "ready" avant que le run immédiat ne charge le pool.
  // ─────────────────────────────────────────────────────────
  try {
    await runMigrations();
    await initSchemaCoherence();
    await initAdminFlag();
    await initStatsTables();
    await initAnalyticsTables(); // ANALYTICS-V1
    await initReadings();
    await initCities();
    await initChat();
    await initTarot();
    await ensureNotificationsSchema();
    await initGrowth();
    await initPromoCodes();
    await initCommunity();
    await initRelationships();
    // ENCRYPT-NATAL-V1 — APRÈS toutes les migrations qui créent les colonnes
    // chiffrées (gender/relationship_status via init-schema-coherence,
    // relationship_category/type via init-relationships).
    await initNatalEncryption();
    await initEmailVerification();
    await initPasswordReset();
    const dedupNorm = await normalizeDedupKeysToDay();
    if (dedupNorm.deletedDuplicates > 0 || dedupNorm.truncatedKeys > 0) {
      app.log.info(dedupNorm, "[init-notifications] dedup keys normalized to YYYY-MM-DD");
    }
    await initGenericHoroscopeTables(); // GENERIC-HOROSCOPES-DDL-FIX-V1
    await initSkyTables(); // SKY-PUBLICATION-DDL-FIX-V1 — table 0008 + colonnes llm_*_advanced
    // Seed/migration des tiers : doit finir sur un pool calme, AVANT le
    // démarrage des schedulers de fond (cf. BOOT-HARDENING-V1 ci-dessus).
    await bootTiers();
    // PAYWALL-V3 : purge des usage_counters orphelins post-PR #37.
    // Idempotent — no-op après le premier boot.
    await cleanupPaywallV3();
  } catch (err) {
    app.log.error({ err }, "Database migration failed");
    process.exit(1);
  }
  const port = parseInt(process.env["PORT"] ?? "4000", 10);
  const host = process.env["HOST"] ?? "0.0.0.0";
  await app.listen({ port, host });
  app.log.info(`🚀 API ready at http://${host}:${port}`);

  // ─────────────────────────────────────────────────────────
  // BOOT-HARDENING-V1 — travaux de fond (fire-and-forget) démarrés
  // SEULEMENT après que l'app écoute (health vert) et que toute la DDL/seed
  // est terminée. Leur `void run()` immédiat ne concurrence plus les
  // migrations de boot.
  // ─────────────────────────────────────────────────────────
  // Backfill bilingue des rows legacy (kairosText: string → {fr, en}).
  // Idempotent : ne fait rien si toutes les rows sont déjà au format objet.
  // Peut prendre quelques secondes avec N appels LLM → fire-and-forget.
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
  startGenericHoroscopes(app.log); // GENERIC-HOROSCOPES-V1
  startNotificationDispatcher(app.log);
  startDailyHoroscopeScheduler(app.log);
  startDbWatchdog(app.log); // SECURITY-DB-WATCHDOG-V1 — surveillance intrusion base + brute-force login
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
