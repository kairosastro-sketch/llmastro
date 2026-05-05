// ============================================================
// apps/api/src/routes/public-sky.ts
// CIEL-PUBLIC-V1-DATA-POSITIONS
// ------------------------------------------------------------
// Route publique (sans auth) — sert l'état du ciel pour 4 cadences.
// La data est lue depuis la table `sky_publication` (peuplée par
// le boot init-sky + setInterval). Si absente (cas rare au tout
// premier hit après boot), on l'ensure synchroniquement.
// ============================================================

import type { FastifyPluginAsync } from "fastify";
import { ensureSkyPublication, isCadence } from "../services/sky-publication.service.js";

export const publicSkyRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /public/sky/:cadence  with cadence ∈ {day, week, month, year}
  fastify.get<{ Params: { cadence: string } }>("/:cadence", async (req, reply) => {
    const { cadence } = req.params;

    if (!isCadence(cadence)) {
      return reply.code(400).send({
        success: false,
        error: {
          code: "BAD_CADENCE",
          message: "cadence must be one of: day, week, month, year",
        },
      });
    }

    try {
      const pub = await ensureSkyPublication(cadence);
      return reply.send({
        success: true,
        data: {
          cadence: pub.cadence,
          periodStart: pub.periodStart,
          periodEnd: pub.periodEnd,
          data: pub.data,
          // null en POSITIONS — sera populé par CIEL-PUBLIC-V1-LLM
          llmText: pub.llmText,
          llmGeneratedAt: pub.llmGeneratedAt,
        },
      });
    } catch (err) {
      req.log.error({ err, cadence }, "[public-sky] ensureSkyPublication failed");
      return reply.code(500).send({
        success: false,
        error: {
          code: "SKY_ERROR",
          message: "Failed to retrieve sky publication",
        },
      });
    }
  });
};

// CIEL-PUBLIC-V1-DATA-POSITIONS route applied
