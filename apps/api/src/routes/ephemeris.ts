import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { natalService } from "../services/natal.service.js";
import { ephemerisService } from "@astro-platform/ephemeris";
import { neo4jService } from "@astro-platform/neo4j";

// Cache en mémoire (clé = natalId:houseSystem)
const chartCache = new Map<string, { data: unknown; expiresAt: number }>();

export const ephemerisRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authMiddleware);

  // POST /ephemeris/calculate/:natalId
  fastify.post<{
    Params: { natalId: string };
    Querystring: { houseSystem?: string };
  }>("/calculate/:natalId", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const { natalId } = req.params;
    const houseSystem = (req.query.houseSystem ?? "P") as "P" | "K" | "W";

    const natal = await natalService.findOne(natalId, userId);
    if (!natal) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Natal profile not found" },
      });
    }

    // ⚠ Migration vers la nouvelle signature objet (avril 2026).
    // L'ancienne signature positionnelle causait un crash systématique :
    //   TimezoneError: Birth date must be YYYY-MM-DD, got "undefined"
    // car calculateNatalChart(input) interprétait `natalId` comme l'objet input.
    const hsMap: Record<string, "placidus" | "koch" | "whole_sign"> = {
      P: "placidus", K: "koch", W: "whole_sign",
    };
    const hsName = hsMap[houseSystem] ?? "placidus";

    const chart = await ephemerisService.calculateNatalChart({
      natalId:        natal.id,
      localBirthDate: natal.birthDate,
      localBirthTime: natal.birthTime ?? "12:00",
      ianaTz:         natal.timezone,
      latitude:       natal.latitude,
      longitude:      natal.longitude,
      birthTimeKnown: !((natal as any).birthTimeUnknown ?? false),
      houseSystem:    hsName,
    });

    // Stocker dans Neo4j avec natalId comme chartId
    try {
      await neo4jService.storeNatalChart(natalId, userId, chart);
    } catch (err) {
      req.log.warn({ err }, "Neo4j storage warning");
    }

    // Mettre en cache (24h)
    const cacheKey = `${natalId}:${houseSystem}`;
    chartCache.set(cacheKey, {
      data: chart,
      expiresAt: Date.now() + 86400 * 1000,
    });

    return reply.send({ success: true, data: { chart, cached: false } });
  });

  // GET /ephemeris/chart/:natalId
  fastify.get<{ Params: { natalId: string }; Querystring: { houseSystem?: string } }>(
    "/chart/:natalId",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const { natalId } = req.params;
      const houseSystem = req.query.houseSystem ?? "P";

      const natal = await natalService.findOne(natalId, userId);
      if (!natal) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Natal profile not found" },
        });
      }

      // Vérifier le cache
      const cacheKey = `${natalId}:${houseSystem}`;
      const cached = chartCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return reply.send({ success: true, data: { chart: cached.data, cached: true } });
      }

      // Essayer Neo4j
      try {
        const chart = await neo4jService.getNatalChart(natalId);
        if (chart) {
          chartCache.set(cacheKey, { data: chart, expiresAt: Date.now() + 86400 * 1000 });
          return reply.send({ success: true, data: { chart, cached: false } });
        }
      } catch (err) {
        req.log.warn({ err }, "Neo4j read warning");
      }

      return reply.code(404).send({
        success: false,
        error: { code: "CHART_NOT_FOUND", message: "Chart not calculated yet" },
      });
    }
  );
};
