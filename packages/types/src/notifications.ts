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
  /** Index zodiacal 0-11 (Bélier=0). Identique au signe de la lunation :
   *   - solaire (new moon)  : Soleil & Lune conjoints → même signe
   *   - lunaire (full moon) : signe de la Lune (corps éclipsé), opposé au Soleil
   *  Optionnel pour compat avec les rows DB pré-Phase 1G+. */
  sign?: number;
  /** Magnitude qualitative dérivée de la distance Soleil↔nœud lunaire :
   *   - "total"    : alignement central (ou annulaire pour solaire)
   *   - "partial"  : couverture significative
   *   - "marginal" : à peine détectable, souvent observateur-dépendant
   *  Optionnel pour compat avec les rows DB pré-Phase 1G+ qui n'ont pas
   *  ce champ (le dispatcher tourne toutes les 6h, les anciennes notifs
   *  ne sont pas ré-écrites à cause du dedup_key journalier). */
  magnitude?: EclipseMagnitude;
  /** ECLIPSE-MAGNITUDE-V1 : magnitude précise renvoyée par Swiss
   *  Ephemeris (`swe_sol_eclipse_where` / `swe_lun_eclipse_how`).
   *   - solaire : rapport diamètre apparent Lune/Soleil au point
   *               central (>1 = totale, <1 = annulaire ou partielle)
   *   - lunaire : umbral magnitude (>1 = totale, [0..1[ = partielle,
   *               <0 = pénombrale uniquement)
   *  Absent si l'API tourne en mode astracore (pas swisseph), ou si
   *  la date n'est pas exactement sur une éclipse. Caller doit
   *  fallback sur `magnitude` qualitative dans ce cas. */
  magnitudePrecise?: number;
  /** ECLIPSE-MAGNITUDE-V1 : type précis dérivé du `rflag` Swiss
   *  Ephemeris. Couvre 4 cas solaires + 3 lunaires alors que
   *  `magnitude` qualitative se limitait à 3 buckets. */
  kindPrecise?: PreciseEclipseKind;
}

export type EclipseMagnitude = "total" | "partial" | "marginal";

/** ECLIPSE-MAGNITUDE-V1 — types précis Swiss Ephemeris. */
export type PreciseEclipseKind =
  | "total"       // solaire et lunaire
  | "annular"     // solaire uniquement
  | "partial"     // solaire et lunaire
  | "hybrid"      // solaire uniquement (annulaire-total)
  | "penumbral";  // lunaire uniquement

// ──────────────────────────────────────────────────────────
// Ingress (changement de signe) & Station (rétrograde ↔ direct)
// Détectés par sky-events.service ; exposés sur le wire via
// notifications.data.event au même titre que lunaisons/éclipses.
// ──────────────────────────────────────────────────────────

export interface IngressEvent {
  type:     "ingress";
  date:     string;     // ISO 8601 UTC
  /** Clé de la planète concernée ("sun", "mars", "northNode"…) */
  planet:   string;
  fromSign: number;     // 0–11 — signe quitté
  toSign:   number;     // 0–11 — signe entré
}

export interface StationEvent {
  type:      "station";
  date:      string;    // ISO 8601 UTC
  planet:    string;
  /** Sens du pivot : la planète devient rétrograde, ou redevient directe. */
  direction: "retrograde" | "direct";
}

/** Union de tous les événements cosmiques transportés dans
 *  `SkyEventNotificationData.event`. */
export type SkyEvent = LunationEvent | EclipseEvent | IngressEvent | StationEvent;

// ──────────────────────────────────────────────────────────
// Notification kinds + payloads (`notifications.data` JSONB)
// ──────────────────────────────────────────────────────────

export type NotificationKind = "sky_event" | "system" | "horoscope_daily";

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
 * Texte Kairos stocké dans `SkyEventNotificationData.kairosText`.
 * Union pour cohabiter avec les rows DB pré-Phase 1G+ qui n'ont qu'une string.
 * Le reader frontend narrow sur `typeof === "string"`.
 */
export type KairosText = string | { fr?: string; en?: string };

/**
 * Payload `data` JSONB d'une notification de type "sky_event".
 * `eventType` couvre les 4 familles d'événements cosmiques :
 * éclipses, lunaisons, ingressions (changement de signe) et
 * stations (pivot rétrograde ↔ direct).
 */
export interface SkyEventNotificationData {
  kind: "sky_event";

  /** Type d'événement cosmique */
  eventType: "eclipse" | "lunation" | "ingress" | "station";

  /** Date ISO 8601 UTC de l'événement */
  eventDate: string;

  /** Payload original de sky-events.service (gardé in-toto pour résilience) */
  event: SkyEvent;

  /** Score d'impact personnel calculé par event-relevance.service.
   *  Plus c'est haut, plus l'événement est marquant pour CE natal.
   *  Échelle indicative : 0–25, seuils default : low ≥ 6, medium ≥ 10, high ≥ 14. */
  score: number;

  /** Top 3 aspects formés avec le natal, triés par priorité décroissante */
  topAspects: NotificationAspect[];

  /** Texte court Kairos personnalisé (généré par event-narrative.service côté api).
   *  Deux formes possibles pour cohabiter avec les rows DB pré-bilingue :
   *   - `string` : ancien format mono-langue (langue figée au dispatch)
   *   - `{ fr?, en? }` : nouveau format bilingue (Phase 1G+). La canonique est
   *     dans la langue de l'user au dispatch ; l'autre est une traduction LLM
   *     best-effort (peut être absente si la traduction a échoué). */
  kairosText?: KairosText;

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

/**
 * Payload `data` pour la notification quotidienne d'horoscope (8h locale user).
 * Le `body` est un teaser court personnalisé généré par horoscope-teaser.service,
 * bilingue {fr, en} pour cohabiter avec les switches de locale.
 *
 * Le click navigue vers /dashboard/horoscope (handled par NotificationItem).
 */
export interface HoroscopeDailyNotificationData {
  kind:           "horoscope_daily";
  /** Teaser bilingue ~1-2 phrases ("Aujourd'hui ta Lune fait..."). */
  body:           KairosText;
  /** Date locale ISO du jour de dispatch (YYYY-MM-DD dans la tz de l'user).
   *  Utile pour le rendu ("il y a 2j") et le debug. */
  localDate:      string;
  /** Natal sur lequel le teaser est basé (1er natal du user). */
  natalProfileId: string;
}

export type NotificationData =
  | SkyEventNotificationData
  | SystemNotificationData
  | HoroscopeDailyNotificationData;

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
  notify_threshold?:        "low" | "medium" | "high";
  notify_email_frequency?:  "never" | "weekly" | "instant";
  notify_email_critical?:   boolean;
  /** Notif quotidienne d'horoscope (8h locale user). Default true à l'inscription. */
  notify_daily_horoscope?:  boolean;
  locale?:                  "fr" | "en";
}

export interface ResolvedUserPreferences {
  notify_events: {
    eclipses:  boolean;
    lunations: boolean;
    stations:  boolean;
    ingresses: boolean;
  };
  notify_threshold:        "low" | "medium" | "high";
  notify_email_frequency:  "never" | "weekly" | "instant";
  notify_email_critical:   boolean;
  notify_daily_horoscope:  boolean;
  locale:                  "fr" | "en";
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
  notify_threshold:        "medium",
  notify_email_frequency:  "never",
  notify_email_critical:   true,
  notify_daily_horoscope:  true,
  locale:                  "fr",
};

// NOTIFICATIONS-V1 shared types applied
// INGRESS-STATION-NOTIFS-V1 applied
