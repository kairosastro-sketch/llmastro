// COMMUNITY-V1 — routes des stats sociales anonymes (cf. COMMUNITY-V1.md).
// Membres connectés uniquement (C-15). Feature gratuite : pas de requireEntitlement (C-23).
import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { communityService } from "../services/community.service.js";

const VALID_DIMENSIONS = ["sun", "moon", "ascendant"] as const;

// Auth + rate limit appliqués PAR ROUTE (pas en hook global) : c'est le pattern
// du repo (cf. promo-codes.ts) et il évite qu'un addHook d'autorisation non
// rate-limité soit signalé par l'analyse de sécurité.
const ROUTE_OPTS = (max: number) => ({
  preHandler: authMiddleware,
  config: { rateLimit: { max, timeWindow: "1 minute" } },
});

const communityRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /community/opt-in  { natalId }
  // Désigne le thème "moi", grave le consentement, projette les stats.
  fastify.post<{ Body: { natalId?: string } }>(
    "/opt-in",
    ROUTE_OPTS(10),
    async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const natalId = req.body?.natalId;
    if (!natalId || typeof natalId !== "string") {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "natalId is required" },
      });
    }
    const result = await communityService.optIn(userId, natalId);
    if (!result) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Natal profile not found" },
      });
    }
    return reply.send({ success: true, data: result });
  });

  // DELETE /community/opt-in — retire le consentement, efface la contribution.
  fastify.delete(
    "/opt-in",
    ROUTE_OPTS(10),
    async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    await communityService.optOut(userId);
    return reply.send({ success: true, data: { optedIn: false } });
  });

  // GET /community/me/placement-stats — la place du membre dans la population.
  fastify.get(
    "/me/placement-stats",
    ROUTE_OPTS(30),
    async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const data = await communityService.getMyPlacementStats(userId);
    return reply.send({ success: true, data });
  });

  // GET /community/distribution?dimension=sun|moon|ascendant
  fastify.get<{ Querystring: { dimension?: string } }>(
    "/distribution",
    ROUTE_OPTS(30),
    async (req, reply) => {
    const dim = (req.query.dimension ?? "sun").toLowerCase();
    if (!VALID_DIMENSIONS.includes(dim as (typeof VALID_DIMENSIONS)[number])) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_REQUEST", message: "dimension must be one of sun|moon|ascendant" },
      });
    }
    const data = await communityService.getDistribution(dim as (typeof VALID_DIMENSIONS)[number]);
    return reply.send({ success: true, data });
  });
};

export default communityRoutes;
