// ARCHIVE-3-TIERS-V1
// Middleware d'auth enrichi : valide le JWT puis attache les droits résolus
// (plan + entitlements) à req.authContext pour que les routes y accèdent sans
// aller-retour DB supplémentaire.

import type { FastifyRequest, FastifyReply } from "fastify";
import type { JWTPayload, EntitlementsMap, Subscription } from "@astro-platform/types";
import { entitlementsService } from "../services/entitlements.service.js";
import { subscriptionsService } from "../services/subscriptions.service.js";

// ----------------------------------------------------------
// Type augmentation : on ajoute authContext à FastifyRequest
// ----------------------------------------------------------
declare module "fastify" {
  interface FastifyRequest {
    authContext?: {
      userId:       string;
      email:        string;
      subscription: Subscription | null;
      entitlements: EntitlementsMap;
    };
  }
}

// ----------------------------------------------------------
// Middleware principal
// ----------------------------------------------------------
export async function authMiddleware(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const payload = await req.jwtVerify<JWTPayload>();

    if (payload.type !== "access") {
      return reply.code(401).send({
        success: false,
        error: { code: "INVALID_TOKEN_TYPE", message: "Access token required" },
      });
    }

    // Charge plan + entitlements (depuis cache Redis si possible)
    const [subscription, entitlements] = await Promise.all([
      subscriptionsService.getActive(payload.sub),
      entitlementsService.resolveEntitlements(payload.sub),
    ]);

    req.authContext = {
      userId:       payload.sub,
      email:        payload.email,
      subscription,
      entitlements,
    };
  } catch (err) {
    // Si c'est déjà une erreur de réponse Fastify, on la laisse passer
    if (reply.sent) return;
    req.log?.warn({ err }, "[authMiddleware] verification failed");
    return reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
}

// ----------------------------------------------------------
// Variante "light" : valide juste le JWT sans charger les entitlements.
// À utiliser sur des routes très hot-path où les entitlements ne servent pas
// (ex. /auth/logout). Garde la compat avec l'ancien comportement.
// ----------------------------------------------------------
export async function authMiddlewareLight(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const payload = await req.jwtVerify<JWTPayload>();

    if (payload.type !== "access") {
      return reply.code(401).send({
        success: false,
        error: { code: "INVALID_TOKEN_TYPE", message: "Access token required" },
      });
    }
  } catch {
    return reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
}
