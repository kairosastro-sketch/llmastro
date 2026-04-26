// ARCHIVE-4-TIERS-UI-V1
// Hook ciblé : check d'un entitlement précis.
// Compagnon de useTiers pour du code lisible dans les composants.
"use client";

import { useTiers } from "./useTiers";

export interface UseEntitlementReturn {
  /** L'utilisateur a-t-il accès à cette feature ? */
  allowed:    boolean;
  /** Limite en vigueur (null = illimité, number = quota max) */
  limit:      number | null;
  /** Quota restant (null si pas un quota ou illimité) */
  remaining:  number | null;
  /** ISO de la prochaine remise à zéro (null si pas de reset) */
  resetAt:    string | null;
  /** Source de l'autorisation : plan, override, grant */
  source:     "plan" | "override" | "grant" | null;
  /** La feature a-t-elle été trouvée dans les entitlements du user ? */
  known:      boolean;
}

/**
 * Vérifie si l'utilisateur a accès à une feature.
 *
 * Convention de résolution :
 *  - Pour une feature booléenne (ex: "synastry.monthly") : `allowed = value === true`
 *    ou `allowed = (limit ?? 0) > 0` pour les quotas.
 *  - Pour une feature quota (ex: "ai.chat.daily") : `allowed` devient `false`
 *    quand `remaining === 0` (même si limit > 0).
 *  - Feature inconnue : `allowed = false`, `known = false`.
 */
export function useEntitlement(featureKey: string): UseEntitlementReturn {
  const { getEntitlement } = useTiers();
  const ent = getEntitlement(featureKey);

  if (!ent) {
    return {
      allowed:   false,
      limit:     null,
      remaining: null,
      resetAt:   null,
      source:    null,
      known:     false,
    };
  }

  // Détermine "allowed" selon le type de valeur
  let allowed = false;
  if (ent.valueType === "boolean") {
    allowed = ent.value === true;
  } else if (typeof ent.value === "number") {
    // limit simple (ex: natal.profiles.max = 3)
    allowed = ent.value === -1 || ent.value > 0;
  } else if (ent.value && typeof ent.value === "object" && "max" in ent.value) {
    const max = (ent.value as { max: number }).max;
    if (max === -1) {
      allowed = true;                // illimité
    } else if (ent.remaining !== null && ent.remaining !== undefined) {
      allowed = ent.remaining > 0;   // quota non épuisé
    } else {
      allowed = max > 0;
    }
  }

  return {
    allowed,
    limit:     ent.limit ?? null,
    remaining: ent.remaining ?? null,
    resetAt:   ent.resetAt ?? null,
    source:    ent.source,
    known:     true,
  };
}
