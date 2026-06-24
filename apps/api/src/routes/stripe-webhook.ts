// STRIPE-MVP-V1
// Endpoint webhook Stripe — encapsulé dans son propre plugin Fastify
// pour pouvoir installer un content-type parser raw body sans casser
// les autres routes JSON de l'API.
//
// Stripe signe la requête avec STRIPE_WEBHOOK_SECRET (dashboard ou CLI
// `stripe listen --forward-to`). On vérifie la signature, on mappe
// l'event vers un changement d'abonnement, puis on renvoie 200 le plus
// vite possible. Toute erreur de mapping est loggée mais ne retourne
// pas 5xx à Stripe pour éviter un retry storm sur un event mal-formé.

import type { FastifyPluginAsync } from "fastify";
import type Stripe from "stripe";
import { eq, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { plans, userSubscriptions, users } from "../db/schema.js";
import { stripeService } from "../services/stripe.service.js";
import { subscriptionsService } from "../services/subscriptions.service.js";
import { growthService } from "../services/growth.service.js"; // GROWTH-REFERRAL-CONVERSION-V1
// STRIPE-WELCOME-EMAIL-V1 : email de bienvenue post-souscription.
import { sendEmail, isMailerConfigured } from "../services/mailer.js";
import { userPreferencesService } from "../services/user-preferences.service.js";
import { renderSubscriptionWelcomeEmail } from "../services/email-templates/subscription-welcome-email.js";

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

// Stripe a déplacé current_period_end de Subscription → SubscriptionItem
// dans l'API ≥ 2025-04. On tente les deux pour rester compatible.
function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const any = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts = any.current_period_end
    ?? any.items?.data?.[0]?.current_period_end
    ?? null;
  return ts ? new Date(ts * 1000) : null;
}

async function planCodeForPriceId(priceId: string | null): Promise<string | null> {
  if (!priceId) return null;
  // PRICING-ANNUAL-V1 : un plan peut être souscrit en mensuel (stripe_price_id)
  // ou en annuel (stripe_price_id_year) — les deux pointent le même plan/entitlements.
  const [row] = await db
    .select({ code: plans.code })
    .from(plans)
    .where(or(eq(plans.stripePriceId, priceId), eq(plans.stripePriceIdYear, priceId)))
    .limit(1);
  return row?.code ?? null;
}

async function userIdForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const [row] = await db
    .select({ userId: userSubscriptions.userId })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.userId ?? null;
}

// STRIPE-WELCOME-EMAIL-V1
// Envoie l'email de bienvenue après une souscription réussie. Best-effort :
// jamais bloquant, jamais throw vers le webhook (un Resend down ne doit pas
// déclencher un retry Stripe). No-op si le mailer n'est pas configuré.
// Déclenché uniquement sur checkout.session.completed (première souscription),
// pas sur les renouvellements/updates — pour ne pas spammer.
async function sendWelcomeEmail(
  userId: string,
  planCode: string,
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void },
): Promise<void> {
  try {
    if (!isMailerConfigured()) {
      log.warn({ userId }, "[stripe-webhook] RESEND_API_KEY missing — skip welcome email");
      return;
    }
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.email) {
      log.warn({ userId }, "[stripe-webhook] welcome email skipped — user/email not found");
      return;
    }

    const [plan] = await db
      .select({ name: plans.name })
      .from(plans)
      .where(eq(plans.code, planCode))
      .limit(1);
    const planName = plan?.name ?? planCode;

    const prefs   = await userPreferencesService.get(userId);
    const locale  = prefs.locale === "en" ? "en" : "fr";
    const appUrl  = (process.env["APP_URL"]?.trim() || "http://localhost:3000").replace(/\/$/, "");

    const { subject, html, text } = renderSubscriptionWelcomeEmail({
      name:         user.name,
      planName,
      dashboardUrl: `${appUrl}/dashboard`,
      manageUrl:    `${appUrl}/dashboard/account`,
      contactUrl:   `${appUrl}/contact`,
      locale,
    });

    const res = await sendEmail({ to: user.email, subject, html, text });
    log.info({ userId, planCode, resendId: res.id }, "[stripe-webhook] welcome email sent");
  } catch (err) {
    log.warn({ err, userId }, "[stripe-webhook] welcome email failed (non-fatal)");
  }
}

// Récupère le userId depuis plusieurs sources possibles (metadata > session > customer).
async function resolveUserId(opts: {
  metadataUserId?: string | null;
  clientReferenceId?: string | null;
  customerId?: string | null;
}): Promise<string | null> {
  if (opts.metadataUserId)    return opts.metadataUserId;
  if (opts.clientReferenceId) return opts.clientReferenceId;
  return userIdForCustomer(opts.customerId ?? null);
}

// Récupère l'id customer/subscription depuis un champ Stripe qui peut être
// string | { id: string } | null selon que l'object soit expand ou non.
function asId(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "id" in v && typeof (v as { id: unknown }).id === "string") {
    return (v as { id: string }).id;
  }
  return null;
}

// ----------------------------------------------------------
// Handlers par type d'event
// ----------------------------------------------------------
async function handleCheckoutCompleted(
  event: Stripe.Event,
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void },
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerId     = asId(session.customer);
  const subscriptionId = asId(session.subscription);
  const userId = await resolveUserId({
    metadataUserId:    session.metadata?.["userId"] ?? null,
    clientReferenceId: session.client_reference_id,
    customerId,
  });

  if (!userId || !subscriptionId) {
    log.warn({ eventId: event.id, userId, subscriptionId }, "[stripe-webhook] checkout.completed missing ids");
    return;
  }

  // Source de vérité = la subscription Stripe (status réel, period_end, price).
  const sub = await stripeService.retrieveSubscription(subscriptionId);
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const planCode = await planCodeForPriceId(priceId);
  if (!planCode) {
    log.warn({ priceId, subscriptionId }, "[stripe-webhook] no plan matches stripe price id");
    return;
  }

  await subscriptionsService.setPlan(userId, planCode, {
    status:               stripeService.mapStripeStatus(sub.status),
    currentPeriodEnd:     getPeriodEnd(sub),
    stripeSubscriptionId: sub.id,
    stripeCustomerId:     customerId ?? undefined,
  });
  log.info({ userId, planCode, status: sub.status }, "[stripe-webhook] checkout.completed → plan switched");

  // STRIPE-WELCOME-EMAIL-V1 : email de bienvenue (best-effort, non bloquant).
  await sendWelcomeEmail(userId, planCode, log);

  // GROWTH-REFERRAL-CONVERSION-V1 : si ce payeur a été parrainé, récompense le
  // parrain (bon « 1 mois Essentiel »). Non-bloquant + idempotent (converted_at),
  // 100% DB (gift code) — aucun appel Stripe.
  void growthService.rewardOnConversion(userId)
    .then((r) => { if (r.rewarded) log.info({ userId }, "[growth] referral conversion → referrer rewarded"); })
    .catch((err: unknown) => log.warn({ err, userId }, "[growth] rewardOnConversion failed (non-blocking)"));
}

async function handleSubscriptionUpserted(
  event: Stripe.Event,
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void },
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = asId(sub.customer);
  const userId = await resolveUserId({
    metadataUserId: sub.metadata?.["userId"] ?? null,
    customerId,
  });
  if (!userId) {
    log.warn({ eventId: event.id, subscriptionId: sub.id }, "[stripe-webhook] subscription.updated no userId");
    return;
  }

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const planCode = await planCodeForPriceId(priceId);
  if (!planCode) {
    log.warn({ priceId, subscriptionId: sub.id }, "[stripe-webhook] no plan matches price id");
    return;
  }

  await subscriptionsService.setPlan(userId, planCode, {
    status:               stripeService.mapStripeStatus(sub.status),
    currentPeriodEnd:     getPeriodEnd(sub),
    stripeSubscriptionId: sub.id,
    stripeCustomerId:     customerId ?? undefined,
  });
  log.info({ userId, planCode, status: sub.status }, "[stripe-webhook] subscription updated");
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void },
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = asId(sub.customer);
  const userId = await resolveUserId({
    metadataUserId: sub.metadata?.["userId"] ?? null,
    customerId,
  });
  if (!userId) {
    log.warn({ eventId: event.id }, "[stripe-webhook] subscription.deleted no userId");
    return;
  }

  // Rétrograde vers free. On conserve stripeCustomerId pour les réabonnements.
  await subscriptionsService.setPlan(userId, "free", {
    status:               "canceled",
    currentPeriodEnd:     null,
    stripeSubscriptionId: sub.id,
    stripeCustomerId:     customerId ?? undefined,
  });
  log.info({ userId }, "[stripe-webhook] subscription deleted → downgraded to free");
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void },
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  // Stripe API ≥ 2025-04 a déplacé subscription sur l'item.
  const anyInv = invoice as unknown as { subscription?: unknown; parent?: { subscription_details?: { subscription?: unknown } } };
  const subscriptionId =
    asId(anyInv.subscription)
    ?? asId(anyInv.parent?.subscription_details?.subscription);
  if (!subscriptionId) {
    log.info({ eventId: event.id }, "[stripe-webhook] invoice.payment_failed without subscription (ignored)");
    return;
  }

  // Re-fetch pour récupérer le status canonique (Stripe le passe à past_due ou unpaid).
  const sub = await stripeService.retrieveSubscription(subscriptionId);
  const customerId = asId(sub.customer);
  const userId = await resolveUserId({
    metadataUserId: sub.metadata?.["userId"] ?? null,
    customerId,
  });
  if (!userId) {
    log.warn({ subscriptionId }, "[stripe-webhook] invoice.payment_failed no userId");
    return;
  }

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const planCode = (await planCodeForPriceId(priceId)) ?? "essential";

  await subscriptionsService.setPlan(userId, planCode, {
    status:               stripeService.mapStripeStatus(sub.status),
    currentPeriodEnd:     getPeriodEnd(sub),
    stripeSubscriptionId: sub.id,
    stripeCustomerId:     customerId ?? undefined,
  });
  log.warn({ userId, status: sub.status }, "[stripe-webhook] invoice.payment_failed → status synced");
}

// ----------------------------------------------------------
// Plugin Fastify scopé
// ----------------------------------------------------------
// On enregistre ce plugin via un `register` dédié dans index.ts pour que
// l'addContentTypeParser ne fuie pas sur les autres routes JSON.
// ----------------------------------------------------------
export const stripeWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Raw body parser : Stripe SDK a besoin du Buffer brut pour vérifier la signature.
  // Scope = ce plugin uniquement (encapsulation Fastify).
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  fastify.post(
    "/subscriptions/webhook",
    {
      // Le content-type parser ci-dessus livre déjà un Buffer ; on désactive
      // la validation de schéma pour ne pas passer par l'AJV par défaut.
      schema: { tags: ["subscriptions"] },
      config: { rateLimit: { max: 200, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      if (!stripeService.isEnabled()) {
        return reply.code(503).send({ received: false, error: "stripe not configured" });
      }
      const secret = process.env["STRIPE_WEBHOOK_SECRET"]?.trim();
      if (!secret) {
        req.log.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET missing");
        return reply.code(503).send({ received: false, error: "webhook secret missing" });
      }

      const sig = req.headers["stripe-signature"];
      if (typeof sig !== "string") {
        return reply.code(400).send({ received: false, error: "missing signature header" });
      }
      const raw = req.body;
      if (!Buffer.isBuffer(raw)) {
        return reply.code(400).send({ received: false, error: "raw body required" });
      }

      let event: Stripe.Event;
      try {
        event = stripeService.verifyWebhookSignature(raw, sig, secret);
      } catch (err) {
        req.log.warn({ err }, "[stripe-webhook] signature verification failed");
        return reply.code(400).send({ received: false, error: "invalid signature" });
      }

      // On reply 200 dès que l'on a validé la signature, MAIS on attend
      // que le mapping soit fait pour rester déterministe en test :
      // les events Stripe sont retryés en cas d'erreur, donc on préfère
      // logguer + 200 plutôt qu'un 5xx qui déclenche un retry inutile.
      try {
        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutCompleted(event, req.log);
            break;
          case "customer.subscription.created":
          case "customer.subscription.updated":
            await handleSubscriptionUpserted(event, req.log);
            break;
          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event, req.log);
            break;
          case "invoice.payment_failed":
            await handleInvoicePaymentFailed(event, req.log);
            break;
          default:
            req.log.info({ type: event.type }, "[stripe-webhook] event ignored");
        }
      } catch (err) {
        req.log.error({ err, eventId: event.id, type: event.type }, "[stripe-webhook] handler failure");
        // 200 explicite : Stripe re-poste sinon, et l'event est dans nos logs.
      }

      return reply.code(200).send({ received: true });
    },
  );
};

// STRIPE-MVP-V1 applied
