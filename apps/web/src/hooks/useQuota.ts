// ARCHIVE-4-TIERS-UI-V1
// Hook ciblé pour les quotas périodiques.
// Expose remaining, limit, resetAt, pourcentage consommé et helpers temporels.
"use client";

import { useEntitlement } from "./useEntitlement";

export interface UseQuotaReturn {
  /** Peut-on encore utiliser cette feature maintenant ? */
  allowed:         boolean;
  /** Quota max (null = illimité) */
  limit:           number | null;
  /** Nombre restant (null si pas applicable) */
  remaining:       number | null;
  /** Nombre consommé */
  consumed:        number | null;
  /** Pourcentage consommé [0..1], null si illimité */
  ratio:           number | null;
  /** ISO du prochain reset */
  resetAt:         string | null;
  /** Date du prochain reset (object Date) */
  resetAtDate:     Date | null;
  /** Libellé humain du reset ("dans 3h", "demain", "dans 12j") */
  resetLabel:      string | null;
  /** Feature inconnue du backend ? */
  known:           boolean;
  /** Feature réellement illimitée ? */
  unlimited:       boolean;
}

/**
 * Hook pour afficher l'état d'un quota (barre de progression, compteur, etc.).
 *
 * Exemple :
 *   const q = useQuota("ai.chat.daily");
 *   // => { remaining: 7, limit: 10, ratio: 0.3, resetLabel: "demain" }
 */
export function useQuota(featureKey: string): UseQuotaReturn {
  const { allowed, limit, remaining, resetAt, known } = useEntitlement(featureKey);

  const unlimited = limit === null && known;

  const consumed =
    limit !== null && remaining !== null ? Math.max(0, limit - remaining) : null;

  const ratio =
    limit !== null && limit > 0 && consumed !== null
      ? Math.min(1, consumed / limit)
      : null;

  const resetAtDate = resetAt ? new Date(resetAt) : null;
  const resetLabel = resetAtDate ? formatResetLabel(resetAtDate) : null;

  return {
    allowed,
    limit,
    remaining,
    consumed,
    ratio,
    resetAt,
    resetAtDate,
    resetLabel,
    known,
    unlimited,
  };
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function formatResetLabel(date: Date): string {
  const nowMs = Date.now();
  const diffMs = date.getTime() - nowMs;
  if (diffMs <= 0) return "à l'instant";

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `dans ${mins} min`;
  }
  if (hours < 24) return `dans ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "demain";
  if (days < 31) return `dans ${days} jours`;

  const months = Math.floor(days / 30);
  return months === 1 ? "dans 1 mois" : `dans ${months} mois`;
}
