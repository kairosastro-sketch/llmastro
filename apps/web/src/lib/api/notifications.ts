// ============================================================
// apps/web/src/lib/api/notifications.ts
// NOTIFICATIONS-V1-UI
// ------------------------------------------------------------
// Resource helpers pour le centre de notifications.
// Pattern aligné sur authApi / natalApi / adminApi dans
// `lib/api/client.ts` : on appelle `apiClient.{get,patch}(path, token)`
// et on retourne ApiResponse<T>.
//
// Types côté front : miroir simplifié des types serveur
// (apps/api/src/types/notification-payload.ts). Pas encore
// promus dans `packages/types` — à faire en Phase 1F si besoin
// de partager côté SSR ou worker.
// ============================================================

import { apiClient } from "./client";

// ------------------------------------------------------------
// Types payload (miroir fidèle de api/src/types/notification-payload.ts
// + sky-events.service.ts pour LunationEvent / EclipseEvent).
// ------------------------------------------------------------
export type NotificationKind = "sky_event" | "system";

export type LunationPhase = "new" | "first_quarter" | "full" | "last_quarter";

export interface LunationEvent {
  type:  "lunation";
  date:  string;
  phase: LunationPhase;
  sign:  number; // 0..11 (Bélier..Poissons)
}

/**
 * Labels des 12 signes du zodiaque, indexés par leur ordre tropical
 * standard (0 = Bélier, 11 = Poissons). Utilisé pour rendre les
 * titres de notifications lunation/éclipse, ex: "Pleine Lune en
 * Capricorne".
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

export interface EclipseEvent {
  type:     "eclipse";
  date:     string;
  kind:     "solar" | "lunar";
  lunation: string;
}

export interface NotificationAspect {
  transitPlanet: string;
  natalPlanet:   string;
  type:          string; // "conjunction" | "opposition" | "trine" | "square" | "sextile"
  orb:           number;
}

/**
 * Payload `data` JSONB d'une notif sky_event.
 * Le dispatcher écrit directement le JSON inclus l'event raw + le kairosText
 * personnalisé (pas de title/body bilingues) — voir
 * apps/api/src/services/notification-dispatcher.service.ts.
 */
export interface SkyEventNotificationData {
  kind:           "sky_event";
  eventType:      "eclipse" | "lunation";
  eventDate:      string;
  event:          LunationEvent | EclipseEvent;
  score:          number;
  topAspects:     NotificationAspect[];
  kairosText?:    string;
  natalProfileId: string;
}

/**
 * Payload `data` JSONB d'une notif system (placeholder, hors MVP).
 * title / body sont des strings simples (pas un objet { fr, en }).
 */
export interface SystemNotificationData {
  kind:   "system";
  title:  string;
  body:   string;
  href?:  string;
  level?: "info" | "warning" | "critical";
}

export type NotificationData = SkyEventNotificationData | SystemNotificationData;

export interface NotificationItemPayload {
  id:        string;
  kind:      NotificationKind;
  data:      NotificationData;
  dedupKey:  string;
  readAt:    string | null;
  createdAt: string;
}

export interface NotificationsListResponse {
  items:       NotificationItemPayload[];
  nextCursor:  string | null;
  unreadCount: number;
}

/**
 * Préférences de notifications utilisateur (miroir fidèle de
 * api/src/types/notification-payload.ts UserPreferences).
 *
 * Tous les champs sont optionnels — le backend merge avec les
 * DEFAULT_USER_PREFERENCES côté serveur, donc une PATCH avec un
 * sous-ensemble suffit.
 */
export interface UserPreferences {
  notify_events?: {
    eclipses?:  boolean;
    lunations?: boolean;
    stations?:  boolean;
    ingresses?: boolean;
  };
  notify_threshold?:       "low" | "medium" | "high";
  notify_email_frequency?: "never" | "weekly" | "instant";
  notify_email_critical?:  boolean;
  locale?:                 "fr" | "en";
}

/**
 * Préférences résolues (avec defaults appliqués côté serveur).
 * C'est ce que retourne GET /notifications/preferences.
 */
export interface ResolvedUserPreferences {
  notify_events: {
    eclipses:  boolean;
    lunations: boolean;
    stations:  boolean;
    ingresses: boolean;
  };
  notify_threshold:       "low" | "medium" | "high";
  notify_email_frequency: "never" | "weekly" | "instant";
  notify_email_critical:  boolean;
  locale:                 "fr" | "en";
}

// ------------------------------------------------------------
// Resource helpers
// ------------------------------------------------------------
export const notificationsApi = {
  list: (token: string, opts?: { limit?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (opts?.limit)  qs.set("limit",  String(opts.limit));
    if (opts?.cursor) qs.set("cursor", opts.cursor);
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
};

// NOTIFICATIONS-V1-UI api applied
