// ARCHIVE-3-TIERS-V1
// Middlewares génériques de vérification d'entitlements.
//
// Usage :
//   fastify.post("/ai/chat", {
//     preHandler: [authMiddleware, requireQuota("ai.chat")],
//   }, handler);
//
//   fastify.get("/synastry/:id", {
//     preHandler: [authMiddleware, requireEntitlement("synastry.monthly")],
//   }, handler);
//
// Le flag ENTITLEMENTS_ENFORCED=false désactive l'interdiction (log-only mode).

import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify";
import { entitlementsService } from "../services/entitlements.service.js";
import { isEnforcementActive } from "../config/plans.config.js";

// ----------------------------------------------------------
// requireEntitlement — gate booléenne
// ----------------------------------------------------------
export function requireEntitlement(featureKey: string): preHandlerHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = req.authContext;
    if (!ctx) {
      return reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const allowed = await entitlementsService.check(ctx.userId, featureKey);

    if (!allowed) {
      if (!isEnforcementActive()) {
        req.log?.warn(
          { userId: ctx.userId, featureKey },
          "[entitlements] would deny (enforcement off)"
        );
        return; // laisse passer
      }
      return reply.code(403).send({
        success: false,
        error: {
          code:    "FEATURE_NOT_AVAILABLE",
          message: "Cette fonctionnalité n'est pas disponible dans ton plan actuel.",
          feature: featureKey,
        },
      });
    }
  };
}

// ----------------------------------------------------------
// requireQuota — gate + consommation
// ----------------------------------------------------------
// featureOrBundle :
//   - "ai.chat"       → consume bundle (quota quotidien puis crédits)
//   - "ai.chat.daily" → consume directement un quota (sans credits fallback)
//
// Convention : si la clé existe dans FEATURE_BUNDLES, on utilise consumeBundle.
// Sinon on tente consumeQuota directement.
// ----------------------------------------------------------
import { FEATURE_BUNDLES } from "../services/entitlements.service.js";

export function requireQuota(
  featureOrBundle: string,
  amount = 1
): preHandlerHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = req.authContext;
    if (!ctx) {
      return reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const result = featureOrBundle in FEATURE_BUNDLES
      ? await entitlementsService.consumeBundle(ctx.userId, featureOrBundle, amount)
      : await entitlementsService.consumeQuota(ctx.userId, featureOrBundle, amount);

    if (!result.allowed) {
      if (!isEnforcementActive()) {
        req.log?.warn(
          { userId: ctx.userId, featureOrBundle, reason: result.reason },
          "[entitlements] would block (enforcement off)"
        );
        return;
      }

      const code =
        result.reason === "quota_exceeded" ? "QUOTA_EXCEEDED"
        : result.reason === "feature_disabled" ? "FEATURE_NOT_AVAILABLE"
        : "ENTITLEMENT_DENIED";

      const status = result.reason === "quota_exceeded" ? 429 : 403;

      return reply.code(status).send({
        success: false,
        error: {
          code,
          message:
            result.reason === "quota_exceeded"
              ? "Tu as atteint ta limite pour cette période. Passe à un plan supérieur ou achète un pack."
              : "Cette fonctionnalité n'est pas disponible dans ton plan actuel.",
          feature:   featureOrBundle,
          remaining: result.remaining,
        },
      });
    }

    // Attache le résultat pour que le handler puisse l'exposer dans sa réponse
    // (ex. renvoyer "remaining: 17" au front pour mise à jour immédiate).
    (req as FastifyRequest & { quotaResult?: typeof result }).quotaResult = result;
  };
}
