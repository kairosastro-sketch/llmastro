// ARCHIVE-4-TIERS-UI-V1
// Bus d'événements pour les erreurs de l'API liées aux tiers.
// Le apiClient émet un événement quand il reçoit 403 FEATURE_NOT_AVAILABLE
// ou 429 QUOTA_EXCEEDED, et TiersContext s'y abonne pour ouvrir le paywall.
//
// Singleton pour éviter tout problème de couplage direct apiClient ↔ TiersContext.

export type TiersErrorReason =
  | "feature_not_available"
  | "quota_exceeded"
  | "entitlement_denied";

export interface TiersErrorPayload {
  reason:    TiersErrorReason;
  feature?:  string;     // ex: "ai.chat", "synastry.monthly"
  remaining?: number | null;
  message?:  string;
}

const EVENT_NAME = "tiers:error";

// Singleton EventTarget (API DOM native, dispo côté client Next.js)
let bus: EventTarget | null = null;

function getBus(): EventTarget {
  if (bus) return bus;
  if (typeof window === "undefined") {
    // SSR : on renvoie un bus dummy jamais utilisé
    return new EventTarget();
  }
  bus = new EventTarget();
  return bus;
}

/**
 * Émet un événement d'erreur tiers. À appeler depuis le apiClient
 * dès qu'une réponse d'erreur liée aux entitlements est reçue.
 */
export function emitTiersError(payload: TiersErrorPayload): void {
  const target = getBus();
  target.dispatchEvent(
    new CustomEvent<TiersErrorPayload>(EVENT_NAME, { detail: payload })
  );
}

/**
 * S'abonne aux erreurs tiers. Retourne la fonction de désabonnement.
 */
export function onTiersError(
  handler: (payload: TiersErrorPayload) => void
): () => void {
  const target = getBus();
  const listener = (e: Event) => {
    const custom = e as CustomEvent<TiersErrorPayload>;
    handler(custom.detail);
  };
  target.addEventListener(EVENT_NAME, listener);
  return () => target.removeEventListener(EVENT_NAME, listener);
}

/**
 * Helper : détecte une réponse d'erreur tiers dans un payload d'API.
 * Retourne null si ce n'est pas une erreur tiers.
 */
export function parseTiersError(body: unknown): TiersErrorPayload | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  if (obj["success"] !== false) return null;

  const err = obj["error"];
  if (!err || typeof err !== "object") return null;
  const code = (err as Record<string, unknown>)["code"];

  let reason: TiersErrorReason | null = null;
  if (code === "FEATURE_NOT_AVAILABLE") reason = "feature_not_available";
  else if (code === "QUOTA_EXCEEDED") reason = "quota_exceeded";
  else if (code === "ENTITLEMENT_DENIED") reason = "entitlement_denied";
  if (!reason) return null;

  const e = err as Record<string, unknown>;
  return {
    reason,
    feature:   typeof e["feature"] === "string" ? (e["feature"] as string) : undefined,
    remaining: typeof e["remaining"] === "number" ? (e["remaining"] as number) : null,
    message:   typeof e["message"] === "string" ? (e["message"] as string) : undefined,
  };
}
