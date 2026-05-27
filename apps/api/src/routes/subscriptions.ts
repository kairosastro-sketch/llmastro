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
import { planEntitlements, plans, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  stripeService,
  StripeNotConfiguredError,
  StripePriceMissingError,
} from "../services/stripe.service.js";

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

// STRIPE-MVP-V1 — body schemas
const checkoutBodySchema = {
  body: {
    type: "object",
    required: ["planCode"],
    properties: {
      planCode: { type: "string", enum: ["essential"] },
    },
    additionalProperties: false,
  },
} as const;

interface CheckoutBody {
  planCode: "essential";
}

// Récupère APP_URL une fois, fallback localhost dev.
function appUrl(): string {
  return (process.env["APP_URL"]?.trim() || "http://localhost:3000").replace(/\/$/, "");
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
            // [PRICING-STRIPE-NOT-LIVE-V1] Le plan est achetable seulement
            // si un stripe_price_id est lié. Free n'a pas besoin de Stripe.
            // Pour Premium (soft-launch contact-only) le flag n'est pas
            // utilisé côté UI (CTA mailto codé en dur dans PlanCTA).
            purchasable:   plan.priceCents === 0 ? true : !!plan.stripePriceId,
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

  // --------------------------------------------------------
  // POST /subscriptions/checkout — STRIPE-MVP-V1
  // --------------------------------------------------------
  // Crée une session Stripe Checkout pour le plan demandé et renvoie
  // l'URL hébergée. Le front redirige l'utilisateur vers cette URL.
  // Succès : Stripe redirige vers APP_URL/subscriptions/success?session_id=...
  // Annulation : APP_URL/pricing?canceled=1
  // --------------------------------------------------------
  fastify.post<{ Body: CheckoutBody }>(
    "/checkout",
    {
      preHandler: [authMiddleware],
      schema: { ...checkoutBodySchema, tags: ["subscriptions"], security: [{ bearerAuth: [] }] },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      if (!stripeService.isEnabled()) {
        return reply.code(503).send({
          success: false,
          error: {
            code:    "STRIPE_NOT_CONFIGURED",
            message: "Le paiement n'est pas encore activé sur cet environnement.",
          },
        });
      }

      // Lookup plan + price id en DB (la colonne stripe_price_id est seedée depuis l'env).
      const [plan] = await db
        .select()
        .from(plans)
        .where(eq(plans.code, req.body.planCode))
        .limit(1);

      if (!plan) {
        return reply.code(404).send({
          success: false,
          error: { code: "PLAN_NOT_FOUND", message: "Plan introuvable" },
        });
      }

      if (!plan.stripePriceId) {
        req.log.error({ planCode: plan.code }, "[stripe] price id missing for plan");
        return reply.code(503).send({
          success: false,
          error: {
            code:    "STRIPE_PRICE_MISSING",
            message: "Ce plan n'est pas encore disponible à la souscription.",
          },
        });
      }

      // Récupère l'email canonique du user + son customer Stripe s'il existe déjà.
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      if (!user) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "Utilisateur introuvable" },
        });
      }

      const stripeCustomerId = ctx.subscription?.stripeCustomerId ?? null;

      try {
        const session = await stripeService.createCheckoutSession({
          userId:           ctx.userId,
          userEmail:        user.email,
          stripePriceId:    plan.stripePriceId,
          stripeCustomerId,
          successUrl:       `${appUrl()}/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl:        `${appUrl()}/pricing?canceled=1`,
        });

        if (!session.url) {
          req.log.error({ sessionId: session.id }, "[stripe] checkout session missing url");
          return reply.code(502).send({
            success: false,
            error: { code: "STRIPE_SESSION_INVALID", message: "Session Stripe invalide" },
          });
        }

        return reply.send({ success: true, data: { url: session.url } });
      } catch (err) {
        if (err instanceof StripeNotConfiguredError || err instanceof StripePriceMissingError) {
          return reply.code(503).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        req.log.error({ err }, "[stripe] checkout session create failed");
        return reply.code(502).send({
          success: false,
          error: { code: "STRIPE_ERROR", message: "Impossible de créer la session de paiement" },
        });
      }
    }
  );

  // --------------------------------------------------------
  // POST /subscriptions/portal — STRIPE-MVP-V1
  // --------------------------------------------------------
  // Crée une session Customer Portal Stripe pour le user courant
  // (gérer le moyen de paiement, annuler, télécharger les factures).
  // Requiert qu'un stripe_customer_id existe sur la subscription.
  // --------------------------------------------------------
  fastify.post(
    "/portal",
    {
      preHandler: [authMiddleware],
      schema: { tags: ["subscriptions"], security: [{ bearerAuth: [] }] },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      if (!stripeService.isEnabled()) {
        return reply.code(503).send({
          success: false,
          error: {
            code:    "STRIPE_NOT_CONFIGURED",
            message: "Le paiement n'est pas encore activé sur cet environnement.",
          },
        });
      }

      const stripeCustomerId = ctx.subscription?.stripeCustomerId;
      if (!stripeCustomerId) {
        return reply.code(409).send({
          success: false,
          error: {
            code:    "NO_STRIPE_CUSTOMER",
            message: "Aucun abonnement Stripe à gérer pour ce compte.",
          },
        });
      }

      try {
        const session = await stripeService.createPortalSession(
          stripeCustomerId,
          `${appUrl()}/dashboard?tab=subscription`,
        );
        return reply.send({ success: true, data: { url: session.url } });
      } catch (err) {
        req.log.error({ err }, "[stripe] portal session create failed");
        return reply.code(502).send({
          success: false,
          error: { code: "STRIPE_ERROR", message: "Impossible d'ouvrir le portail de gestion" },
        });
      }
    }
  );
};
