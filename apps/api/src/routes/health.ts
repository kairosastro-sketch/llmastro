import type { FastifyPluginAsync } from "fastify";
import { neo4jService } from "@astro-platform/neo4j";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (_req, reply) => {
    const checks = await Promise.allSettled([
      neo4jService.verifyConnectivity(),
    ]);

    const neo4j = checks[0]?.status === "fulfilled";
    const status = neo4j ? 200 : 503;

    return reply.code(status).send({
      status:    status === 200 ? "ok" : "degraded",
      version:   process.env["npm_package_version"] ?? "0.1.0",
      timestamp: new Date().toISOString(),
      services:  { neo4j: neo4j ? "up" : "down" },
    });
  });

  fastify.get("/ready", async (_req, reply) => {
    return reply.send({ ready: true });
  });
};
