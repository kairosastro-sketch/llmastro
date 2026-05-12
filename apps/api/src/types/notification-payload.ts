// ============================================================
// apps/api/src/types/notification-payload.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// Bridge vers @astro-platform/types : les types wire ont été
// promus dans packages/types pour éviter le drift api↔web.
// On garde NOTIFY_THRESHOLD_VALUES ici (scoring backend pur,
// n'apparaît jamais sur le wire).
// ============================================================

export type {
  LunationPhase,
  LunationEvent,
  EclipseEvent,
  EclipseMagnitude,
  KairosText,
  NotificationKind,
  NotificationAspect,
  SkyEventNotificationData,
  SystemNotificationData,
  HoroscopeDailyNotificationData,
  NotificationData,
  NotificationItemPayload,
  NotificationsListResponse,
  UserPreferences,
  ResolvedUserPreferences,
} from "@astro-platform/types";

export { DEFAULT_USER_PREFERENCES } from "@astro-platform/types";

import type { UserPreferences } from "@astro-platform/types";

/** Seuils numériques de score correspondant aux paliers user.
 *  Backend-only (utilisé par le dispatcher pour filtrer les events). */
export const NOTIFY_THRESHOLD_VALUES: Record<NonNullable<UserPreferences["notify_threshold"]>, number> = {
  low:    6,
  medium: 10,
  high:   14,
};

// NOTIFICATIONS-V1 types applied
