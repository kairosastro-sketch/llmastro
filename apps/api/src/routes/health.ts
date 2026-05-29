import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db/index.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (_req, reply) => {
    const checks = await Promise.allSettled([
      pool.query("SELECT 1"),
    ]);

    const postgres = checks[0]?.status === "fulfilled";
    const status = postgres ? 200 : 503;

    return reply.code(status).send({
      status:    status === 200 ? "ok" : "degraded",
      version:   process.env["npm_package_version"] ?? "0.1.0",
      timestamp: new Date().toISOString(),
      services:  { postgres: postgres ? "up" : "down" },
    });
  });

  fastify.get("/ready", async (_req, reply) => {
    return reply.send({ ready: true });
  });
};
