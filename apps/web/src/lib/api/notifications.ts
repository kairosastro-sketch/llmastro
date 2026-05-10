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
  LunationEvent,
  LunationPhase,
  NotificationAspect,
  NotificationData,
  NotificationItemPayload,
  NotificationKind,
  NotificationsListResponse,
  ResolvedUserPreferences,
  SkyEventNotificationData,
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
