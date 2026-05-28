// PROMO-CODES-V1
// Route user-facing : POST /promo-codes/redeem
// Authentifié, body { code }, renvoie l'effet appliqué.

import type { FastifyPluginAsync } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { promoCodesService, PromoCodeError } from "../services/promo-codes.service.js";

const promoCodesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { code: string } }>(
    "/redeem",
    {
      preHandler: authMiddleware,
      schema: {
        body: {
          type: "object",
          required: ["code"],
          properties: {
            code: { type: "string", minLength: 3, maxLength: 40 },
          },
          additionalProperties: false,
        },
      },
      // Throttle agressif pour empêcher le brute-force sur les codes.
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const userId = req.authContext!.userId;
      try {
        const result = await promoCodesService.redeemPromo(userId, req.body.code);
        return reply.send({ success: true, data: result });
      } catch (err) {
        if (err instanceof PromoCodeError) {
          return reply.code(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        req.log.error({ err }, "[promo-codes] redeem failed");
        return reply.code(500).send({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Redeem failed" },
        });
      }
    },
  );
};

export default promoCodesRoutes;
export { promoCodesRoutes };

// PROMO-CODES-V1 applied
