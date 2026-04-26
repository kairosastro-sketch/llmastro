// ARCHIVE-4-TIERS-UI-V1
// Routes pour consulter plans et abonnement + endpoint dev set-plan.
// /subscriptions/plans est public (catalogue), /subscriptions/me et /dev/set-plan
// nécessitent l'auth.
//
// Le endpoint /dev/set-plan n'est actif que si DEV_PLAN_SWITCH=true (env).
// Permet de tester les parcours Premium sans Stripe.

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { subscriptionsService } from "../services/subscriptions.service.js";
import { entitlementsService } from "../services/entitlements.service.js";
import { db } from "../db/index.js";
import { planEntitlements, plans } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ----------------------------------------------------------
// Schemas
// ----------------------------------------------------------
const setPlanBodySchema = {
  body: {
    type: "object",
    required: ["planCode"],
    properties: {
      planCode: { type: "string", enum: ["free", "essential", "premium"] },
      withTrial: { type: "boolean" },
    },
    additionalProperties: false,
  },
} as const;

interface SetPlanBody {
  planCode:   "free" | "essential" | "premium";
  withTrial?: boolean;
}

// ----------------------------------------------------------
// Plugin
// ----------------------------------------------------------
export const subscriptionsRoutes: FastifyPluginAsync = async (fastify) => {

  // --------------------------------------------------------
  // GET /subscriptions/plans — catalogue public
  // --------------------------------------------------------
  fastify.get(
    "/plans",
    { schema: { tags: ["subscriptions"] } },
    async (_req, reply: FastifyReply) => {
      const rows = await subscriptionsService.listAllPlans();

      const out = await Promise.all(
        rows.map(async (plan) => {
          const ents = await db
            .select({
              featureKey: planEntitlements.featureKey,
              valueType:  planEntitlements.valueType,
              value:      planEntitlements.value,
            })
            .from(planEntitlements)
            .where(eq(planEntitlements.planId, plan.id));

          return {
            id:            plan.id,
            code:          plan.code,
            name:          plan.name,
            description:   plan.description,
            priceCents:    plan.priceCents,
            currency:      plan.currency,
            billingPeriod: plan.billingPeriod,
            isActive:      plan.isActive,
            sortOrder:     plan.sortOrder,
            entitlements:  ents,
          };
        })
      );

      return reply.send({ success: true, data: { plans: out } });
    }
  );

  // --------------------------------------------------------
  // GET /subscriptions/me
  // --------------------------------------------------------
  fastify.get(
    "/me",
    { preHandler: [authMiddleware], schema: { tags: ["subscriptions"], security: [{ bearerAuth: [] }] } },
    async (req: FastifyRequest, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      return reply.send({
        success: true,
        data: {
          subscription: ctx.subscription,
          entitlements: ctx.entitlements,
        },
      });
    }
  );

  // --------------------------------------------------------
  // GET /subscriptions/plans/:code
  // --------------------------------------------------------
  fastify.get<{ Params: { code: string } }>(
    "/plans/:code",
    { schema: { tags: ["subscriptions"] } },
    async (req, reply) => {
      const [plan] = await db.select().from(plans).where(eq(plans.code, req.params.code)).limit(1);
      if (!plan) {
        return reply.code(404).send({
          success: false,
          error: { code: "PLAN_NOT_FOUND", message: "Plan introuvable" },
        });
      }

      const ents = await db
        .select({
          featureKey: planEntitlements.featureKey,
          valueType:  planEntitlements.valueType,
          value:      planEntitlements.value,
        })
        .from(planEntitlements)
        .where(eq(planEntitlements.planId, plan.id));

      return reply.send({
        success: true,
        data: {
          plan: {
            id:            plan.id,
            code:          plan.code,
            name:          plan.name,
            description:   plan.description,
            priceCents:    plan.priceCents,
            currency:      plan.currency,
            billingPeriod: plan.billingPeriod,
            isActive:      plan.isActive,
            sortOrder:     plan.sortOrder,
            entitlements:  ents,
          },
        },
      });
    }
  );

  // --------------------------------------------------------
  // POST /subscriptions/dev/set-plan
  // --------------------------------------------------------
  // Dev-only : bascule le plan de l'utilisateur courant sans passer par Stripe.
  // Gardé par le flag env DEV_PLAN_SWITCH=true. À retirer/désactiver en prod
  // une fois Stripe en place.
  //
  // Body: { planCode: "free"|"essential"|"premium", withTrial?: boolean }
  // --------------------------------------------------------
  fastify.post<{ Body: SetPlanBody }>(
    "/dev/set-plan",
    {
      preHandler: [authMiddleware],
      schema: { ...setPlanBodySchema, tags: ["subscriptions", "dev"], security: [{ bearerAuth: [] }] },
    },
    async (req, reply) => {
      if (process.env["DEV_PLAN_SWITCH"] !== "true") {
        return reply.code(403).send({
          success: false,
          error: {
            code:    "DEV_PLAN_SWITCH_DISABLED",
            message: "Cet endpoint est désactivé. Active DEV_PLAN_SWITCH=true pour l'utiliser.",
          },
        });
      }

      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const { planCode, withTrial } = req.body;
      const now = new Date();

      // Si on passe en essential avec trial explicite, on positionne une période
      const currentPeriodEnd =
        withTrial && planCode === "essential"
          ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          : null;

      const status = withTrial && planCode === "essential" ? "trialing" : "active";

      const updated = await subscriptionsService.setPlan(ctx.userId, planCode, {
        status,
        currentPeriodEnd,
      });

      // Invalide le cache pour que le prochain /auth/me reflète le changement
      await entitlementsService.invalidate(ctx.userId);

      req.log?.info(
        { userId: ctx.userId, newPlan: planCode, withTrial },
        "[dev] plan switched"
      );

      return reply.send({
        success: true,
        data: { subscription: updated },
      });
    }
  );
};
