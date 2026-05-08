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
// Types payload (miroir api/src/types/notification-payload.ts)
// ------------------------------------------------------------
export type NotificationKind = "sky_event" | "system";

export interface NotificationAspect {
  natalPlanet: string;
  type:        string;
  orb:         number;
}

export interface SkyEventNotificationData {
  kind:      "sky_event";
  eventType: "lunation" | "eclipse";
  eventDate: string;
  title:     { fr: string; en: string };
  body:      { fr: string; en: string };
  aspects?:  NotificationAspect[];
  score:     number;
}

export interface SystemNotificationData {
  kind:  "system";
  title: { fr: string; en: string };
  body:  { fr: string; en: string };
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

export interface UserPreferences {
  notify_lunations?: boolean;
  notify_eclipses?:  boolean;
  notify_threshold?: "low" | "medium" | "high";
  email_frequency?:  "off" | "daily" | "weekly";
  locale?:           "fr" | "en";
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

  getPrefs: (token: string) =>
    apiClient.get<{ preferences: UserPreferences }>(
      "/notifications/preferences",
      token,
    ),

  updatePrefs: (token: string, prefs: UserPreferences) =>
    apiClient.patch<{ preferences: UserPreferences }>(
      "/notifications/preferences",
      prefs,
      token,
    ),
};

// NOTIFICATIONS-V1-UI api applied
