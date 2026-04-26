// ARCHIVE-4-TIERS-UI-V1
// Helper à brancher dans le apiClient existant.
//
// Appelle-le depuis le catch de ton handler d'erreur (ou juste après avoir parsé
// la réponse JSON). Il détecte les erreurs tiers et émet un événement sur l'error-bus,
// ce qui ouvre automatiquement le PaywallModal via TiersContext.
//
// Voir README.md pour le snippet exact à ajouter dans apps/web/src/lib/api/client.ts.

import { emitTiersError, parseTiersError } from "./error-bus";

/**
 * Inspecte un body de réponse API. Si c'est une erreur tiers, émet
 * l'événement et retourne true. Sinon, retourne false (ne fait rien).
 */
export function maybeEmitTiersError(body: unknown): boolean {
  const parsed = parseTiersError(body);
  if (!parsed) return false;
  emitTiersError(parsed);
  return true;
}

/**
 * Variante : prend un Response fetch natif + son body déjà parsé.
 * Émet seulement pour les statuts 403 et 429 (optimisation).
 */
export function maybeEmitTiersErrorFromResponse(
  status: number,
  body: unknown
): boolean {
  if (status !== 403 && status !== 429) return false;
  return maybeEmitTiersError(body);
}
