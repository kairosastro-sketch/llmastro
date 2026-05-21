// ============================================================
// apps/api/src/services/notification-dispatcher.service.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// Dispatcher : pour chaque user actif ayant au moins un natal,
//   1) calcule sa carte natale via ephemerisService.calculateNatalChart
//      (cached, donc ré-exécutions cheap)
//   2) calcule les sky-events des 7 prochains jours via computeAllEvents
//      (calcul une seule fois, partagé entre tous les users)
//   3) filtre par toggles user (notify_events : eclipses / lunations
//      / ingresses / stations)
//   4) score chaque event via scoreEventForUser
//   5) si score >= seuil de l'user → génère texte Kairos
//      (avec fallback déterministe si xAI down/non configuré)
//   6) INSERT idempotent dans notifications via dedup_key
//
// Idempotent par construction : ré-exécutions ne créent jamais
// de doublons (UNIQUE INDEX (user_id, dedup_key)).
//
// Couvre les 4 familles d'événements cosmiques : éclipses,
// lunaisons, ingressions (changement de signe) et stations
// (pivot rétrograde ↔ direct).
// ============================================================

import { eq, isNull } from "drizzle-orm";
import { ephemerisService } from "@astro-platform/ephemeris";
import { db } from "../db/index.js";
import { users, natalData, type NatalData } from "../db/schema.js";
import { computeAllEvents } from "./sky-events.service.js";
import {
  scoreEventForUser,
  buildSkyEventDedupKey,
} from "./event-relevance.service.js";
import {
  generateEventNarrative,
  buildFallbackNarrative,
  translateEventNarrative,
} from "./event-narrative.service.js";
import { notificationsService } from "./notifications.service.js";
import { resolveWithDefaults } from "./user-preferences.service.js";
import {
  NOTIFY_THRESHOLD_VALUES,
  type UserPreferences,
  type SkyEventNotificationData,
  type SkyEvent,
} from "../types/notification-payload.js";
import type { PlanetPosition } from "./transits.service.js";

interface MinimalLogger {
  info:  (...a: any[]) => void;
  warn:  (...a: any[]) => void;
  error: (...a: any[]) => void;
}

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────

/** Fenêtre temporelle d'anticipation : on notifie les events sur les 7 prochains jours. */
const HORIZON_DAYS = 7;
const HORIZON_MS   = HORIZON_DAYS * 24 * 60 * 60 * 1000;

// ──────────────────────────────────────────────────────────
// Stats du dispatch (pour logs / monitoring)
// ──────────────────────────────────────────────────────────

export interface DispatchStats {
  usersProcessed:        number;
  notificationsCreated:  number;
  notificationsSkipped:  number;  // sous le seuil, ou type filtré
  errorsCount:           number;
  candidateEvents:       number;  // events distincts dans la fenêtre
  windowStart:           string;  // ISO
  windowEnd:             string;  // ISO
}

// ──────────────────────────────────────────────────────────
// API publique
// ──────────────────────────────────────────────────────────

/**
 * Run principal du dispatcher : itère tous les users actifs avec un
 * natal et leur génère leurs notifs personnelles pour les events
 * cosmiques à venir.
 *
 * Conçu pour être appelé périodiquement par un setInterval (boot task
 * `startNotificationDispatcher` dans `init-notifications.ts`) — chaque
 * exécution est sûre à répéter (UNIQUE INDEX absorbe les doublons).
 */
export async function dispatchNotificationsForAllUsers(
  logger: MinimalLogger,
): Promise<DispatchStats> {
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_MS);

  // 1. Calcul des events cosmiques pour la fenêtre — UNE FOIS pour tous les users
  const allEvents = computeAllEvents(now, horizon);
  const candidateEvents: SkyEvent[] = [
    ...allEvents.eclipses,
    ...allEvents.lunations,
    ...allEvents.ingresses,
    ...allEvents.stations,
  ];

  const stats: DispatchStats = {
    usersProcessed:       0,
    notificationsCreated: 0,
    notificationsSkipped: 0,
    errorsCount:          0,
    candidateEvents:      candidateEvents.length,
    windowStart:          now.toISOString(),
    windowEnd:            horizon.toISOString(),
  };

  if (candidateEvents.length === 0) {
    logger.info(
      { window: `${stats.windowStart} → ${stats.windowEnd}` },
      "[dispatcher] no candidate events in 7d window — skipping",
    );
    return stats;
  }

  // 2. Charger tous les users actifs ayant au moins un natal
  //    (INNER JOIN écarte les users sans natal — c'est voulu pour le MVP).
  const rows = await db
    .select({
      userId:      users.id,
      preferences: users.preferences,
      natal:       natalData,
    })
    .from(users)
    .innerJoin(natalData, eq(natalData.userId, users.id))
    .where(isNull(users.deletedAt));

  // Dédoublonnage : un user peut avoir plusieurs natals (pour ses proches).
  // MVP : on prend le premier natal rencontré (qui est typiquement le sien).
  // Une amélioration future pourrait introduire un flag is_primary.
  const userMap = new Map<
    string,
    { preferences: UserPreferences | null; natal: NatalData }
  >();
  for (const row of rows) {
    if (!userMap.has(row.userId)) {
      userMap.set(row.userId, {
        preferences: (row.preferences as UserPreferences | null) ?? null,
        natal:       row.natal,
      });
    }
  }

  // 3. Pour chaque user, scoring + insertion
  for (const [userId, { preferences, natal }] of userMap) {
    try {
      const prefs = resolveWithDefaults(preferences);
      const thresholdValue = NOTIFY_THRESHOLD_VALUES[prefs.notify_threshold];

      // Calcul du natal — cached par ephemerisService sur les inputs
      const chart = await ephemerisService.calculateNatalChart({
        natalId:        natal.id,
        localBirthDate: natal.birthDate,
        localBirthTime: natal.birthTime,
        ianaTz:         natal.timezone,
        latitude:       natal.latitude,
        longitude:      natal.longitude,
        birthTimeKnown: !natal.birthTimeUnknown,
      });

      // Adaptation au format Record<key, PlanetPosition> attendu par event-relevance.
      // EnrichedChart.planets est lui-même un Record<string, EnrichedPlanet> — on
      // itère via Object.entries pour utiliser la clé du Record (toujours fiable).
      const natalPositions: Record<string, PlanetPosition> = {};
      for (const [key, p] of Object.entries(chart.planets)) {
        natalPositions[key] = {
          longitude: p.longitude,
          signIdx:   p.signIdx,
        };
      }
      const natalSunSign  = natalPositions["sun"]?.signIdx  ?? 0;
      const natalMoonSign = natalPositions["moon"]?.signIdx ?? 0;

      // Scoring de chaque event candidat
      for (const event of candidateEvents) {
        // Filtrage par toggles user
        if (event.type === "eclipse"  && !prefs.notify_events.eclipses)  {
          stats.notificationsSkipped++;
          continue;
        }
        if (event.type === "lunation" && !prefs.notify_events.lunations) {
          stats.notificationsSkipped++;
          continue;
        }
        if (event.type === "ingress"  && !prefs.notify_events.ingresses) {
          stats.notificationsSkipped++;
          continue;
        }
        if (event.type === "station"  && !prefs.notify_events.stations)  {
          stats.notificationsSkipped++;
          continue;
        }

        const relevance = scoreEventForUser(event, natalPositions);
        if (relevance.score < thresholdValue) {
          stats.notificationsSkipped++;
          continue;
        }

        // Pipeline bilingue (2 LLM calls) :
        //   1) Génération canonique dans la langue préférée de l'user.
        //      Fallback déterministe si xAI down/non-configuré.
        //   2) Traduction best-effort vers l'autre langue.
        //      Si fail → on stocke seulement la canonique ; le reader frontend
        //      tombera sur celle-ci puis sur FALLBACK_BODY si l'user switche.
        const primaryLocale = prefs.locale;
        const otherLocale   = primaryLocale === "fr" ? "en" : "fr";

        let canonical: string;
        try {
          canonical = await generateEventNarrative({
            event,
            natalSunSign,
            natalMoonSign,
            topAspects: relevance.topAspects,
            locale:     primaryLocale,
            userId,
          });
        } catch (err) {
          logger.warn(
            { err, userId, eventDate: event.date },
            "[dispatcher] LLM failed, falling back to deterministic template",
          );
          canonical = buildFallbackNarrative({
            event,
            natalSunSign,
            natalMoonSign,
            topAspects: relevance.topAspects,
            locale:     primaryLocale,
          });
        }

        let translated: string | null = null;
        try {
          translated = await translateEventNarrative({
            text: canonical,
            from: primaryLocale,
            to:   otherLocale,
            userId,
          });
        } catch (err) {
          // Best-effort : on log mais on n'écrit pas de fallback déterministe
          // dans l'autre langue — la qualité serait douteuse vs traduction LLM,
          // et le reader sait gérer l'absence (fallback canonique ou FALLBACK_BODY).
          logger.warn(
            { err, userId, eventDate: event.date, from: primaryLocale, to: otherLocale },
            "[dispatcher] translation failed, storing canonical only",
          );
        }

        const kairosText = {
          [primaryLocale]: canonical,
          ...(translated ? { [otherLocale]: translated } : {}),
        };

        // INSERT idempotent
        const dedupKey = buildSkyEventDedupKey(event);
        const data: SkyEventNotificationData = {
          kind:           "sky_event",
          eventType:      event.type,
          eventDate:      event.date,
          event,
          score:          relevance.score,
          topAspects:     relevance.topAspects,
          kairosText,
          natalProfileId: natal.id,
        };

        const inserted = await notificationsService.insertSkyEventIfNew({
          userId,
          dedupKey,
          data,
        });

        if (inserted) {
          stats.notificationsCreated++;
          logger.info(
            {
              userId,
              eventDate: event.date,
              eventType: event.type,
              score:     relevance.score,
            },
            "[dispatcher] notification created",
          );
        }
      }

      stats.usersProcessed++;
    } catch (err) {
      stats.errorsCount++;
      logger.error({ err, userId }, "[dispatcher] user processing failed");
    }
  }

  return stats;
}

// NOTIFICATIONS-V1 dispatcher applied
// INGRESS-STATION-NOTIFS-V1 applied
