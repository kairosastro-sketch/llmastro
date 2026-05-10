// ============================================================
// packages/types/src/notifications.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// Source de vérité unique des types wire api ↔ web pour les
// notifications. Le drift entre `apps/api/src/types/notification-payload.ts`
// et `apps/web/src/lib/api/notifications.ts` était à l'origine
// de bugs (PR #14 payload shape, PR #17 UserPreferences) — d'où
// cette promotion vers packages/types.
//
// Ne rien déposer ici qui ne soit PAS sur le wire :
//   - constantes de scoring (NOTIFY_THRESHOLD_VALUES)        → backend
//   - labels i18n d'affichage   (ZODIAC_SIGN_LABELS)          → web
// ============================================================

// ──────────────────────────────────────────────────────────
// Sky events (sous-ensemble exposé sur le wire dans data.event)
// La source de détection vit dans sky-events.service côté api ;
// celui-ci re-exporte ces types depuis ici pour rester aligné.
// ──────────────────────────────────────────────────────────

export type LunationPhase = "new" | "first_quarter" | "full" | "last_quarter";

export interface LunationEvent {
  type:  "lunation";
  date:  string;          // ISO 8601 UTC
  phase: LunationPhase;
  sign:  number;          // 0–11 (Bélier..Poissons / Aries..Pisces)
}

export interface EclipseEvent {
  type:     "eclipse";
  date:     string;       // ISO 8601 UTC
  kind:     "solar" | "lunar";
  /** ISO date de la lunation associée à cette éclipse */
  lunation: string;
  /** Magnitude qualitative dérivée de la distance Soleil↔nœud lunaire :
   *   - "total"    : alignement central (ou annulaire pour solaire)
   *   - "partial"  : couverture significative
   *   - "marginal" : à peine détectable, souvent observateur-dépendant
   *  Optionnel pour compat avec les rows DB pré-Phase 1G+ qui n'ont pas
   *  ce champ (le dispatcher tourne toutes les 6h, les anciennes notifs
   *  ne sont pas ré-écrites à cause du dedup_key journalier). */
  magnitude?: EclipseMagnitude;
}

export type EclipseMagnitude = "total" | "partial" | "marginal";

// ──────────────────────────────────────────────────────────
// Notification kinds + payloads (`notifications.data` JSONB)
// ──────────────────────────────────────────────────────────

export type NotificationKind = "sky_event" | "system";

/**
 * Top aspect formé entre la position de la planète déclencheuse au
 * moment de l'événement et une position natale de l'utilisateur.
 * Calculé via `computeTransitAspects` côté api.
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

  /** Texte court Kairos personnalisé (généré par event-narrative.service côté api). */
  kairosText?: string;

  /** Quel natal de l'user a déclenché l'alerte (un user peut en avoir plusieurs) */
  natalProfileId: string;
}

/**
 * Payload `data` pour une notification de type "system" (libre).
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
// Wire formats — GET /notifications
// ──────────────────────────────────────────────────────────

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
  unreadCount: number;
}

// ──────────────────────────────────────────────────────────
// User preferences (users.preferences JSONB)
//   - UserPreferences         : tous les champs optionnels (= body PATCH partial)
//   - ResolvedUserPreferences : tous les champs requis     (= return GET, defaults appliqués)
// ──────────────────────────────────────────────────────────

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

/** Defaults appliqués au merge côté serveur (cf. user-preferences.service).
 *  Exporté pour que le front puisse l'utiliser comme placeholder visuel
 *  avant le premier fetch des prefs. */
export const DEFAULT_USER_PREFERENCES: ResolvedUserPreferences = {
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

// NOTIFICATIONS-V1 shared types applied
