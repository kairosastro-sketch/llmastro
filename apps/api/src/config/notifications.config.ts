// ARCHIVE-3-TIERS-V1
// Seuils de quota à partir desquels on déclenche une notif "plus que X restants".
// Utilisé par l'archive 5 (notifications). Déclaré ici dès l'archive 3 pour que
// le service entitlements puisse lire la config même avant l'archive notifs
// (il émettra juste aucun effet tant que notificationsService n'existe pas).

/**
 * Seuils par feature_key. Le service entitlements déclenche une notif "quota.low"
 * quand `remaining` (après décrément) tombe sur une des valeurs listées.
 *
 * Ajouter une clé ici = nouveau quota surveillé, sans toucher au code.
 * Mettre un tableau vide = pas d'alerte pour ce quota.
 */
export const QUOTA_ALERT_THRESHOLDS: Record<string, number[]> = {
  "ai.chat.monthly":            [3, 0],
  "tarot.monthly":              [0],
  "synastry.monthly":         [1, 0],
  "reports.monthly_credits":  [1, 0],
  "ai.natal_reading.monthly": [0],
};

/**
 * Retourne true si le seuil courant déclenche une alerte.
 */
export function shouldAlertForQuota(
  featureKey: string,
  remaining: number
): boolean {
  const thresholds = QUOTA_ALERT_THRESHOLDS[featureKey];
  if (!thresholds) return false;
  return thresholds.includes(remaining);
}

// ARCHIVE-TIERS-V2-CONFIG applied
