// ============================================================
// apps/api/src/services/daily-horoscope-dispatcher.service.ts
// DAILY-HOROSCOPE-NOTIF-V1
// ------------------------------------------------------------
// Dispatch d'une notif d'horoscope quotidienne à 8h locale user.
//
// Tourne toutes les heures (24x/jour). Chaque exécution :
//   1) Charge tous les users actifs ayant >=1 natal
//   2) Pour chaque user :
//      - Skip si prefs.notify_daily_horoscope = false
//      - Calcule l'heure locale (Intl.DateTimeFormat sur users.timezone)
//      - Si heure courante ≠ 8, skip
//      - Calcule la date locale YYYY-MM-DD
//      - dedup_key = horoscope_daily:<userId>:<localDate>
//      - Génère teaser via horoscope-teaser.service (canonique user.locale)
//      - Traduit best-effort vers l'autre lang via translateEventNarrative
//      - INSERT IF NEW (UNIQUE INDEX absorbe les rerun dans la fenêtre 8h-9h)
//
// Idempotent : si on tourne plusieurs fois entre 8h et 9h locale, le
// dedup_key journalier empêche les doublons.
// ============================================================

import { eq, isNull } from "drizzle-orm";

import { db } from "../db/index.js";
import { users, natalData, type NatalData } from "../db/schema.js";
import { ephemerisService } from "@astro-platform/ephemeris";
import {
  generateHoroscopeTeaser,
  buildFallbackTeaser,
} from "./horoscope-teaser.service.js";
import { translateEventNarrative } from "./event-narrative.service.js";
import { resolveWithDefaults } from "./user-preferences.service.js";
import { notificationsService } from "./notifications.service.js";
import { dispatchPushToUser } from "./push-dispatch.service.js";
import type {
  UserPreferences,
  HoroscopeDailyNotificationData,
} from "../types/notification-payload.js";

const TARGET_HOUR = 8; // 8h locale user

interface MinimalLogger {
  info:  (...a: any[]) => void;
  warn:  (...a: any[]) => void;
  error: (...a: any[]) => void;
}

interface DailyHoroscopeStats {
  usersScanned:         number;
  notificationsCreated: number;
  skippedNotTargetHour: number;
  skippedOptedOut:      number;
  skippedAlreadySent:   number;
  errors:               number;
}

/**
 * Calcule { hour: 0-23, localDate: YYYY-MM-DD } dans une timezone IANA.
 * Utilise Intl.DateTimeFormat — natif Node, pas de dépendance externe.
 *
 * Si la timezone est invalide, throw → le caller catche et log puis skip.
 */
function getLocalHourAndDate(tz: string, now: Date): { hour: number; date: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
    hour:     "2-digit",
    hour12:   false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  // hour: "24" peut apparaître à minuit selon Intl impl — on normalise en 0
  const rawHour = parseInt(get("hour"), 10);
  return {
    hour: rawHour === 24 ? 0 : rawHour,
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export async function dispatchDailyHoroscopeForAllUsers(
  logger: MinimalLogger,
): Promise<DailyHoroscopeStats> {
  const stats: DailyHoroscopeStats = {
    usersScanned:         0,
    notificationsCreated: 0,
    skippedNotTargetHour: 0,
    skippedOptedOut:      0,
    skippedAlreadySent:   0,
    errors:               0,
  };

  const now = new Date();

  // Charger users + 1er natal (INNER JOIN écarte les users sans natal — voulu).
  const rows = await db
    .select({
      userId:      users.id,
      timezone:    users.timezone,
      preferences: users.preferences,
      natal:       natalData,
    })
    .from(users)
    .innerJoin(natalData, eq(natalData.userId, users.id))
    .where(isNull(users.deletedAt));

  const userMap = new Map<
    string,
    { tz: string; preferences: UserPreferences | null; natal: NatalData }
  >();
  for (const row of rows) {
    if (!userMap.has(row.userId)) {
      userMap.set(row.userId, {
        tz:          row.timezone ?? "UTC",
        preferences: (row.preferences as UserPreferences | null) ?? null,
        natal:       row.natal,
      });
    }
  }

  for (const [userId, { tz, preferences, natal }] of userMap) {
    stats.usersScanned++;
    try {
      const prefs = resolveWithDefaults(preferences);
      if (!prefs.notify_daily_horoscope) {
        stats.skippedOptedOut++;
        continue;
      }

      // Heure et date dans la tz user
      let hour: number; let localDate: string;
      try {
        const local = getLocalHourAndDate(tz, now);
        hour = local.hour;
        localDate = local.date;
      } catch (err) {
        logger.warn({ err, userId, tz }, "[daily-horoscope] invalid timezone, skipping");
        stats.errors++;
        continue;
      }

      if (hour !== TARGET_HOUR) {
        stats.skippedNotTargetHour++;
        continue;
      }

      const dedupKey = `horoscope_daily:${userId}:${localDate}`;

      // Calculer le natal (cached par ephemerisService)
      const chart = await ephemerisService.calculateNatalChart({
        natalId:        natal.id,
        localBirthDate: natal.birthDate,
        localBirthTime: natal.birthTime,
        ianaTz:         natal.timezone,
        latitude:       natal.latitude,
        longitude:      natal.longitude,
        birthTimeKnown: !natal.birthTimeUnknown,
      });
      const natalSunSign  = chart.planets["sun"]?.signIdx  ?? 0;
      const natalMoonSign = chart.planets["moon"]?.signIdx ?? 0;

      // Génération teaser dans la lang canonique
      const primaryLocale = prefs.locale;
      const otherLocale   = primaryLocale === "fr" ? "en" : "fr";

      let canonical: string;
      try {
        canonical = await generateHoroscopeTeaser({
          natalSunSign,
          natalMoonSign,
          localDate,
          locale: primaryLocale,
          userId,
        });
      } catch (err) {
        logger.warn(
          { err, userId },
          "[daily-horoscope] LLM teaser failed, falling back to deterministic",
        );
        canonical = buildFallbackTeaser({
          natalSunSign,
          natalMoonSign,
          localDate,
          locale: primaryLocale,
        });
      }

      // Traduction best-effort vers l'autre lang
      let translated: string | null = null;
      try {
        translated = await translateEventNarrative({
          text: canonical,
          from: primaryLocale,
          to:   otherLocale,
          userId,
        });
      } catch (err) {
        logger.warn(
          { err, userId, from: primaryLocale, to: otherLocale },
          "[daily-horoscope] translation failed, storing canonical only",
        );
      }

      const data: HoroscopeDailyNotificationData = {
        kind: "horoscope_daily",
        body: {
          [primaryLocale]: canonical,
          ...(translated ? { [otherLocale]: translated } : {}),
        },
        localDate,
        natalProfileId: natal.id,
      };

      const inserted = await notificationsService.insertIfNew({
        userId,
        kind:     "horoscope_daily",
        data,
        dedupKey,
      });

      if (inserted) {
        stats.notificationsCreated++;
        logger.info(
          { userId, localDate, tz },
          "[daily-horoscope] notification inserted",
        );

        // WEB-PUSH-V1 — push best-effort vers tous les devices opt-in.
        if (prefs.notify_push) {
          try {
            await dispatchPushToUser({
              userId,
              locale: prefs.locale,
              data,
              logger,
            });
          } catch (err) {
            logger.warn({ err, userId }, "[daily-horoscope] push dispatch failed (non-fatal)");
          }
        }
      } else {
        stats.skippedAlreadySent++;
      }
    } catch (err) {
      logger.error({ err, userId }, "[daily-horoscope] user dispatch failed");
      stats.errors++;
    }
  }

  return stats;
}

// DAILY-HOROSCOPE-NOTIF-V1 dispatcher applied
