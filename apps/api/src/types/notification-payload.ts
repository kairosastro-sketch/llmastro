// ============================================================
// apps/api/src/types/notification-payload.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// Types du payload `data` JSONB stocké dans `notifications.data`,
// et de la colonne `users.preferences` JSONB.
//
// Le service `event-relevance` (PR #B) construit `SkyEventNotificationData`
// après avoir scoré un sky-event vs le natal d'un utilisateur.
// Le service `event-narrative` (PR #C) remplit `kairosText`.
// Le dispatcher (PR #D) écrit la notification en DB.
// ============================================================

import type { LunationEvent, EclipseEvent } from "../services/sky-events.service.js";

// ──────────────────────────────────────────────────────────
// Payload des notifications "sky_event"
// ──────────────────────────────────────────────────────────

/**
 * Top aspect formé entre la position de la planète déclencheuse au
 * moment de l'événement et une position natale de l'utilisateur.
 * Calculé via `computeTransitAspects` (transits.service).
 */
export interface NotificationAspect {
  transitPlanet: string;
  natalPlanet:   string;
  type:          string;   // "conjunction" | "opposition" | "trine" | "square" | "sextile"
  orb:           number;   // degrés
}

/**
 * Payload `data` JSONB d'une notification de type "sky_event".
 * MVP : eventType = "eclipse" | "lunation" uniquement.
 * Phase 4 ajoutera "ingress" | "station".
 */
export interface SkyEventNotificationData {
  kind: "sky_event";

  /** Type d'événement (sous-ensemble du MVP) */
  eventType: "eclipse" | "lunation";

  /** Date ISO 8601 UTC de l'événement */
  eventDate: string;

  /** Payload original de sky-events.service (gardé in-toto pour résilience) */
  event: LunationEvent | EclipseEvent;

  /** Score d'impact personnel calculé par event-relevance.service.
   *  Plus c'est haut, plus l'événement est marquant pour CE natal.
   *  Échelle indicative : 0–25, seuils default : low ≥ 6, medium ≥ 10, high ≥ 14. */
  score: number;

  /** Top 3 aspects formés avec le natal, triés par priorité décroissante */
  topAspects: NotificationAspect[];

  /** Texte court Kairos personnalisé. Optionnel : rempli par PR #C. */
  kairosText?: string;

  /** Quel natal de l'user a déclenché l'alerte (un user peut en avoir plusieurs) */
  natalProfileId: string;
}

/**
 * Payload `data` pour une notification de type "system" (libre).
 * Utilisé pour des messages génériques (par ex : maintenance, info compte).
 * Hors MVP — placeholder pour ne pas avoir à ré-élargir le union plus tard.
 */
export interface SystemNotificationData {
  kind:   "system";
  title:  string;
  body:   string;
  href?:  string;       // lien optionnel vers une page interne
  level?: "info" | "warning" | "critical";
}

export type NotificationData = SkyEventNotificationData | SystemNotificationData;

// ──────────────────────────────────────────────────────────
// Préférences utilisateur (users.preferences JSONB)
// ──────────────────────────────────────────────────────────

/**
 * Préférences de notification d'un user. Tout est optionnel —
 * l'absence d'un champ = valeur par défaut hardcodée côté code.
 *
 * Défauts :
 *   notify_events.eclipses        = true
 *   notify_events.lunations       = true
 *   notify_events.stations        = false  (Phase 4)
 *   notify_events.ingresses       = false  (Phase 4)
 *   notify_threshold              = "medium"
 *   notify_email_frequency        = "never"  (Phase 2 introduit "weekly" puis "instant")
 *   notify_email_critical         = true
 *   locale                        = "fr"
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

/** Valeurs par défaut centralisées. Lecture : merger user.preferences avec ces defaults. */
export const DEFAULT_USER_PREFERENCES: Required<{
  notify_events: Required<NonNullable<UserPreferences["notify_events"]>>;
  notify_threshold:        UserPreferences["notify_threshold"];
  notify_email_frequency:  UserPreferences["notify_email_frequency"];
  notify_email_critical:   UserPreferences["notify_email_critical"];
  locale:                  UserPreferences["locale"];
}> = {
  notify_events: {
    eclipses:  true,
    lunations: true,
    stations:  false,
    ingresses: false,
  },
  notify_threshold:       "medium",
  notify_email_frequency: "never",
  notify_email_critical:  true,
  locale:                 "fr",
};

/** Seuils numériques de score correspondant aux paliers user. */
export const NOTIFY_THRESHOLD_VALUES: Record<NonNullable<UserPreferences["notify_threshold"]>, number> = {
  low:    6,
  medium: 10,
  high:   14,
};

// NOTIFICATIONS-V1 types applied
