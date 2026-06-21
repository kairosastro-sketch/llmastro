// ============================================================
// apps/web/src/lib/api/notifications.ts
// NOTIFICATIONS-V1-UI
// ------------------------------------------------------------
// Resource helpers pour le centre de notifications.
// Pattern aligné sur authApi / natalApi / adminApi dans
// `lib/api/client.ts` : on appelle `apiClient.{get,patch}(path, token)`
// et on retourne ApiResponse<T>.
//
// Les types wire (NotificationData, UserPreferences, etc.) vivent
// désormais dans @astro-platform/types — réexportés ici pour que
// les composants/hooks existants n'aient pas à changer leurs imports.
// ============================================================

import { apiClient } from "./client";
import type {
  NotificationsListResponse,
  ResolvedUserPreferences,
  UserPreferences,
} from "@astro-platform/types";

export type {
  EclipseEvent,
  EclipseMagnitude,
  HoroscopeDailyNotificationData,
  IngressEvent,
  KairosText,
  LunationEvent,
  LunationPhase,
  NotificationAspect,
  NotificationData,
  NotificationItemPayload,
  NotificationKind,
  NotificationsListResponse,
  ResolvedUserPreferences,
  SkyEvent,
  SkyEventNotificationData,
  StationEvent,
  SystemNotificationData,
  UserPreferences,
} from "@astro-platform/types";

/**
 * Labels des 12 signes du zodiaque, indexés par leur ordre tropical
 * standard (0 = Bélier, 11 = Poissons). Utilisé pour rendre les
 * titres de notifications lunation/éclipse, ex: "Pleine Lune en
 * Capricorne". Display-only — n'apparaît pas sur le wire.
 */
export const ZODIAC_SIGN_LABELS = {
  fr: [
    "Bélier", "Taureau", "Gémeaux", "Cancer",
    "Lion",   "Vierge",  "Balance", "Scorpion",
    "Sagittaire", "Capricorne", "Verseau", "Poissons",
  ] as const,
  en: [
    "Aries",  "Taurus",  "Gemini",  "Cancer",
    "Leo",    "Virgo",   "Libra",   "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ] as const,
} as const;

/**
 * Labels des planètes, indexés par leur clé wire ("sun", "mars",
 * "northNode"…). Utilisé pour rendre les titres de notifications
 * ingress / station, ex: "Mars entre en Lion". Display-only —
 * n'apparaît pas sur le wire. Fallback sur la clé brute si inconnue.
 */
export const ZODIAC_PLANET_LABELS: Record<"fr" | "en", Record<string, string>> = {
  fr: {
    sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus", mars: "Mars",
    jupiter: "Jupiter", saturn: "Saturne", uranus: "Uranus", neptune: "Neptune",
    pluto: "Pluton", northNode: "Nœud Nord", southNode: "Nœud Sud",
    // ASTEROIDS-V1
    chiron: "Chiron", lilith: "Lilith", lilithTrue: "Lilith vraie",
    ceres: "Cérès", pallas: "Pallas", juno: "Junon", vesta: "Vesta",
  },
  en: {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
    jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune",
    pluto: "Pluto", northNode: "North Node", southNode: "South Node",
    // ASTEROIDS-V1
    chiron: "Chiron", lilith: "Lilith", lilithTrue: "True Lilith",
    ceres: "Ceres", pallas: "Pallas", juno: "Juno", vesta: "Vesta",
  },
};

// ------------------------------------------------------------
// Resource helpers
// ------------------------------------------------------------
export const notificationsApi = {
  list: (token: string, opts?: { limit?: number }) => {
    const qs = new URLSearchParams();
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get<NotificationsListResponse>(`/notifications${suffix}`, token);
  },

  markRead: (token: string, id: string) =>
    apiClient.patch<{ id: string; readAt: string }>(
      `/notifications/${id}/read`,
      {},
      token,
    ),

  markAllRead: (token: string) =>
    apiClient.patch<{ updated: number }>(
      "/notifications/mark-all-read",
      {},
      token,
    ),

  clearAll: (token: string) =>
    apiClient.delete<{ deleted: number }>("/notifications/all", token),

  getPrefs: (token: string) =>
    apiClient.get<{ preferences: ResolvedUserPreferences }>(
      "/notifications/preferences",
      token,
    ),

  updatePrefs: (token: string, prefs: UserPreferences) =>
    apiClient.patch<{ preferences: ResolvedUserPreferences }>(
      "/notifications/preferences",
      prefs,
      token,
    ),

  // ------------------------------------------------------------
  // WEB-PUSH-V1 — gestion des subscriptions Web Push API
  // ------------------------------------------------------------

  /** Lit l'état VAPID côté API. Si `configured=false`, le frontend doit
   *  désactiver l'opt-in push (l'admin n'a pas set VAPID_PRIVATE_KEY). */
  getPushConfig: (token: string) =>
    apiClient.get<{ configured: boolean; publicKey: string }>(
      "/notifications/push/config",
      token,
    ),

  /** Enregistre (ou met à jour) une PushSubscription côté API. Idempotent
   *  via ON CONFLICT (endpoint) — appel multiple sans danger. */
  pushSubscribe: (
    token: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) =>
    apiClient.post<{ ok: true }>(
      "/notifications/push/subscribe",
      subscription,
      token,
    ),

  /** Supprime la subscription de ce device côté API. À appeler conjointement
   *  avec `PushSubscription.unsubscribe()` côté navigateur. Signature : le
   *  body est passé en arg2 et le token en arg3 (cf. apiClient.delete). */
  pushUnsubscribe: (token: string, endpoint: string) =>
    apiClient.delete<{ ok: true }>(
      "/notifications/push/subscribe",
      { endpoint },
      token,
    ),
};

// NOTIFICATIONS-V1-UI api applied
// WEB-PUSH-V1 api applied
