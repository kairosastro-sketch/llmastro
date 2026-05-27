// STRIPE-MVP-V1
// Wrapper Stripe SDK. Singleton paresseux : aucun appel réseau au boot.
// Si STRIPE_SECRET_KEY est absent, le service est en mode "désactivé" :
// isEnabled() renvoie false et toute tentative de création de session
// lève StripeNotConfiguredError. Le webhook répond 503 dans ce cas.

import Stripe from "stripe";

// ----------------------------------------------------------
// Erreurs typées (mappées vers des codes HTTP côté routes)
// ----------------------------------------------------------
export class StripeNotConfiguredError extends Error {
  code = "STRIPE_NOT_CONFIGURED";
  constructor() {
    super("Stripe is not configured on this environment");
  }
}

export class StripePriceMissingError extends Error {
  code = "STRIPE_PRICE_MISSING";
  constructor(planCode: string) {
    super(`Stripe price id missing for plan "${planCode}"`);
  }
}

// ----------------------------------------------------------
// Client paresseux
// ----------------------------------------------------------
let cachedClient: Stripe | null = null;

function getClient(): Stripe {
  if (cachedClient) return cachedClient;
  const secret = process.env["STRIPE_SECRET_KEY"]?.trim();
  if (!secret) throw new StripeNotConfiguredError();
  // apiVersion : on laisse stripe-node piocher la version par défaut de la
  // major installée (évite un drift de schéma à chaque bump SDK). On surcharge
  // via STRIPE_API_VERSION si on veut épingler.
  const apiVersion = process.env["STRIPE_API_VERSION"]?.trim();
  cachedClient = new Stripe(secret, apiVersion ? { apiVersion: apiVersion as Stripe.LatestApiVersion } : {});
  return cachedClient;
}

export function isEnabled(): boolean {
  return Boolean(process.env["STRIPE_SECRET_KEY"]?.trim());
}

// ----------------------------------------------------------
// Checkout session
// ----------------------------------------------------------
export interface CreateCheckoutInput {
  userId:           string;
  userEmail:        string;
  stripePriceId:    string;
  stripeCustomerId: string | null;
  successUrl:       string;
  cancelUrl:        string;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<Stripe.Checkout.Session> {
  const stripe = getClient();
  return stripe.checkout.sessions.create({
    mode:     "subscription",
    line_items: [{ price: input.stripePriceId, quantity: 1 }],
    // On préfère customer (réutilisable) à customer_email pour ne pas créer
    // un nouveau Customer Stripe à chaque tentative. Si on n'a pas encore
    // de customer (premier paiement), Stripe en crée un automatiquement
    // en mode subscription ; on récupère son id dans le webhook
    // checkout.session.completed. NB: `customer_creation` est réservé au
    // mode "payment" — Stripe rejette le param en subscription.
    ...(input.stripeCustomerId
      ? { customer: input.stripeCustomerId }
      : { customer_email: input.userEmail }),
    client_reference_id: input.userId,
    // metadata duplique l'info dans l'event webhook (suspenders + belt :
    // client_reference_id peut être trimé sur certaines events legacy).
    metadata: { userId: input.userId },
    subscription_data: { metadata: { userId: input.userId } },
    success_url: input.successUrl,
    cancel_url:  input.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    automatic_tax: { enabled: false },
  });
}

// ----------------------------------------------------------
// Customer Portal
// ----------------------------------------------------------
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getClient();
  return stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: returnUrl,
  });
}

// ----------------------------------------------------------
// Webhook
// ----------------------------------------------------------
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = getClient();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// ----------------------------------------------------------
// Subscription lookup (utilisé par le webhook pour reconstituer l'état canon)
// ----------------------------------------------------------
export async function retrieveSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getClient();
  return stripe.subscriptions.retrieve(subscriptionId);
}

// ----------------------------------------------------------
// Mapping Stripe status → notre status interne
// ----------------------------------------------------------
// Stripe statuses : "incomplete" | "incomplete_expired" | "trialing" | "active"
//                 | "past_due" | "canceled" | "unpaid" | "paused"
// Notre col status accepte : "active"|"trialing"|"canceled"|"past_due"|"incomplete"
export function mapStripeStatus(
  s: Stripe.Subscription.Status,
): "active" | "trialing" | "canceled" | "past_due" | "incomplete" {
  switch (s) {
    case "active":             return "active";
    case "trialing":           return "trialing";
    case "past_due":           return "past_due";
    case "unpaid":             return "past_due";
    case "canceled":           return "canceled";
    case "incomplete":         return "incomplete";
    case "incomplete_expired": return "canceled";
    case "paused":             return "canceled";
    default:                   return "incomplete";
  }
}

export const stripeService = {
  isEnabled,
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  retrieveSubscription,
  mapStripeStatus,
};

// STRIPE-MVP-V1 applied
