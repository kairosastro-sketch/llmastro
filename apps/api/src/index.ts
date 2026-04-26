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
import { horoscopeRoutes }  from "./routes/horoscope.js";
import { transitsRoutes } from "./routes/transits.js";
import { aiRoutes } from "./routes/ai.js";
import { compatRoutes }  from "./routes/compat.js";
import { healthRoutes }     from "./routes/health.js";
import { neo4jService }     from "@astro-platform/neo4j";
import { runMigrations, pool } from "./db/index.js";
import adminRoutes from "./routes/admin.js";
import { initReadings } from "./boot/init-readings.js"; // ARCHIVE-PERSISTENCE-LECTURES-IA-V2
import { subscriptionsRoutes } from "./routes/subscriptions.js"; // ARCHIVE-4-TIERS-UI-V1
import { bootTiers } from "./boot/seed-plans.js"; // ARCHIVE-3-TIERS-V1

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env["LOG_LEVEL"] ?? "info" },
    trustProxy: true,
    ajv: { customOptions: { allErrors: true, removeAdditional: true } },
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: [
      process.env["APP_URL"] ?? "http://localhost:3000",
      /http:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?/,
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  await app.register(jwt, {
    secret: process.env["JWT_SECRET"] ?? "dev-secret-change-me",
    sign: { expiresIn: process.env["JWT_ACCESS_EXPIRES_IN"] ?? "15m" },
    cookie: { cookieName: "refreshToken", signed: false },
  });

  await app.register(cookie, {
    secret: process.env["JWT_REFRESH_SECRET"] ?? "cookie-secret",
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
  await app.register(authRoutes,      { prefix: "/auth" });
  await app.register(subscriptionsRoutes, { prefix: "/subscriptions" }); // ARCHIVE-4-TIERS-UI-V1
  await app.register(natalRoutes,     { prefix: "/natal" });
  await app.register(ephemerisRoutes, { prefix: "/ephemeris" });
  await app.register(horoscopeRoutes, { prefix: "/horoscope" });
  await app.register(transitsRoutes, { prefix: "/transits" });
  await app.register(aiRoutes,       { prefix: "/ai" });
  await app.register(compatRoutes,   { prefix: "/compat" });
  await app.register(adminRoutes, { prefix: "/admin" }); // ARCHIVE-PERSISTENCE-LECTURES-IA-V2

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
    await initReadings(); // ARCHIVE-PERSISTENCE-LECTURES-IA-V2
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
  await bootTiers(); // ARCHIVE-3-TIERS-V1
  await app.listen({ port, host });
  app.log.info(`🚀 API ready at http://${host}:${port}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// ARCHIVE-PERSISTENCE-LECTURES-IA-V2 index applied
