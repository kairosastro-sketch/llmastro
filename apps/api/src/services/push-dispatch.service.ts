// ============================================================
// apps/api/src/services/push-dispatch.service.ts
// WEB-PUSH-V1
// ------------------------------------------------------------
// Envoi de notifications Web Push (RFC 8292) aux subscriptions
// d'un utilisateur.
//
// Pipeline appelé par les deux dispatchers (sky-events + daily-
// horoscope) après que `notifications.service.insertIfNew()` a
// confirmé l'insertion DB. Le push est un side-effect best-effort :
// si l'envoi échoue, la notif reste en in-app — l'user la verra au
// prochain refresh du drawer.
//
// Configuration VAPID :
//   - Si VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT sont
//     manquants → `isConfigured()` retourne false et `dispatchToUser`
//     est un no-op silencieux (les notifs in-app continuent).
//   - Les clés sont lues une fois au premier appel `getWebPush()` et
//     cachées (le module web-push garde son état interne).
//
// Cleanup automatique des subscriptions expirées : sur erreur 404
// (endpoint introuvable) ou 410 (Gone — user a désinstallé l'app),
// on DELETE la row push_subscriptions correspondante. Les autres
// erreurs (réseau, 5xx) sont loguées et ignorées — la prochaine
// notif retentera.
// ============================================================

import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "../db/index.js";
import { pushSubscriptions, type PushSubscriptionRow } from "../db/schema.js";
import type {
  NotificationData,
  KairosText,
} from "../types/notification-payload.js";

interface MinimalLogger {
  info:  (...a: any[]) => void;
  warn:  (...a: any[]) => void;
  error: (...a: any[]) => void;
}

// ──────────────────────────────────────────────────────────
// Configuration VAPID
// ──────────────────────────────────────────────────────────

let configuredCached: boolean | null = null;

function readVapidConfig(): {
  publicKey:  string;
  privateKey: string;
  subject:    string;
} | null {
  const publicKey  = process.env["VAPID_PUBLIC_KEY"]?.trim();
  const privateKey = process.env["VAPID_PRIVATE_KEY"]?.trim();
  const subject    = process.env["VAPID_SUBJECT"]?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  // RFC 8292 §2.1 : subject doit être un mailto: ou https: URL.
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    return null;
  }
  return { publicKey, privateKey, subject };
}

/** True si toutes les variables VAPID sont présentes et valides.
 *  Résultat caché — utile car appelé à chaque dispatch. */
export function isPushConfigured(): boolean {
  if (configuredCached !== null) return configuredCached;
  const cfg = readVapidConfig();
  if (!cfg) {
    configuredCached = false;
    return false;
  }
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  configuredCached = true;
  return true;
}

// ──────────────────────────────────────────────────────────
// Labels signes / planètes pour le titre du push
// ──────────────────────────────────────────────────────────
// Dupliqué localement pour ne pas ajouter de dépendance circulaire vers
// event-narrative / horoscope-teaser. Les 4 services qui en ont besoin
// les inlinent déjà — une consolidation est à faire en chantier séparé.

const SIGN_NAMES_FR = [
  "Bélier","Taureau","Gémeaux","Cancer","Lion","Vierge",
  "Balance","Scorpion","Sagittaire","Capricorne","Verseau","Poissons",
];
const SIGN_NAMES_EN = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
];

const PLANET_NAMES_FR: Record<string, string> = {
  sun: "Soleil", moon: "Lune", mercury: "Mercure", venus: "Vénus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturne", uranus: "Uranus", neptune: "Neptune",
  pluto: "Pluton", northNode: "Nœud Nord", southNode: "Nœud Sud",
};
const PLANET_NAMES_EN: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune",
  pluto: "Pluto", northNode: "North Node", southNode: "South Node",
};

function signLabel(idx: number, locale: "fr" | "en"): string {
  const arr = locale === "en" ? SIGN_NAMES_EN : SIGN_NAMES_FR;
  return arr[idx] ?? "?";
}
function planetLabel(key: string, locale: "fr" | "en"): string {
  const map = locale === "en" ? PLANET_NAMES_EN : PLANET_NAMES_FR;
  return map[key] ?? key;
}

function pickKairos(text: KairosText | undefined, locale: "fr" | "en"): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return text[locale] ?? text[locale === "fr" ? "en" : "fr"] ?? "";
}

// ──────────────────────────────────────────────────────────
// Construction du payload push à partir d'une NotificationData
// ──────────────────────────────────────────────────────────

interface PushPayload {
  title: string;
  body:  string;
  url:   string;     // deeplink à ouvrir au notificationclick
  tag?:  string;     // dédoublonne côté navigateur (replace au lieu d'empile)
}

function buildPushPayload(
  data: NotificationData,
  locale: "fr" | "en",
): PushPayload {
  if (data.kind === "sky_event") {
    const ev = data.event;
    const isFr = locale === "fr";
    let title: string;
    switch (ev.type) {
      case "lunation": {
        const phaseFr: Record<typeof ev.phase, string> = {
          new:           "Nouvelle Lune",
          first_quarter: "Premier quartier",
          full:          "Pleine Lune",
          last_quarter:  "Dernier quartier",
        };
        const phaseEn: Record<typeof ev.phase, string> = {
          new:           "New Moon",
          first_quarter: "First Quarter",
          full:          "Full Moon",
          last_quarter:  "Last Quarter",
        };
        const phase = (isFr ? phaseFr : phaseEn)[ev.phase];
        title = `${phase} ${isFr ? "en" : "in"} ${signLabel(ev.sign, locale)}`;
        break;
      }
      case "eclipse": {
        const kind = ev.kind === "solar"
          ? (isFr ? "Éclipse solaire" : "Solar eclipse")
          : (isFr ? "Éclipse lunaire" : "Lunar eclipse");
        title = ev.sign !== undefined
          ? `${kind} ${isFr ? "en" : "in"} ${signLabel(ev.sign, locale)}`
          : kind;
        break;
      }
      case "ingress":
        title = `${planetLabel(ev.planet, locale)} ${isFr ? "entre en" : "enters"} ${signLabel(ev.toSign, locale)}`;
        break;
      case "station":
        title = ev.direction === "retrograde"
          ? `${planetLabel(ev.planet, locale)} ${isFr ? "devient rétrograde" : "turns retrograde"}`
          : `${planetLabel(ev.planet, locale)} ${isFr ? "redevient directe" : "turns direct"}`;
        break;
    }
    return {
      title,
      body: pickKairos(data.kairosText, locale),
      url:  "/dashboard?notifs=open",
      tag:  `sky_event:${data.eventType}:${data.eventDate}`,
    };
  }

  if (data.kind === "horoscope_daily") {
    return {
      title: locale === "fr" ? "Ton horoscope du jour" : "Your daily horoscope",
      body:  pickKairos(data.body, locale),
      url:   "/dashboard/horoscope",
      tag:   `horoscope_daily:${data.localDate}`,
    };
  }

  // system
  return {
    title: data.title,
    body:  data.body,
    url:   data.href ?? "/dashboard?notifs=open",
    tag:   `system:${data.level ?? "info"}`,
  };
}

// ──────────────────────────────────────────────────────────
// Envoi
// ──────────────────────────────────────────────────────────

/**
 * Envoie le payload aux N subscriptions de l'utilisateur. No-op si :
 *   - VAPID pas configuré (env vars manquantes)
 *   - L'user n'a aucune subscription
 *
 * Les erreurs réseau / 5xx sont loguées et ignorées (retry au prochain
 * dispatch). Les erreurs 404 / 410 déclenchent un cleanup de la row.
 *
 * Best-effort — ne throw jamais. Si tu veux un guarantee de delivery,
 * vérifie le retour stats (`sent`/`removed`/`failed`).
 */
export async function dispatchPushToUser(input: {
  userId: string;
  locale: "fr" | "en";
  data:   NotificationData;
  logger: MinimalLogger;
}): Promise<{ sent: number; removed: number; failed: number }> {
  const stats = { sent: 0, removed: 0, failed: 0 };

  if (!isPushConfigured()) return stats;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, input.userId));

  if (subs.length === 0) return stats;

  const payload = buildPushPayload(input.data, input.locale);
  const payloadStr = JSON.stringify(payload);

  // Parallélise — chaque endpoint est indépendant, et un push service lent
  // ne doit pas bloquer les autres devices. Promise.allSettled pour ne
  // jamais throw même si un device échoue.
  const results = await Promise.allSettled(
    subs.map((sub) => sendOne(sub, payloadStr)),
  );

  const toDelete: string[] = [];
  const toRefresh: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const sub = subs[i]!;
    if (r.status === "fulfilled") {
      stats.sent++;
      toRefresh.push(sub.id);
    } else {
      const err = r.reason as { statusCode?: number; message?: string };
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        // Subscription expirée ou inconnue du push service — on purge.
        toDelete.push(sub.id);
        stats.removed++;
      } else {
        input.logger.warn(
          { err: err?.message, code, userId: input.userId, endpoint: truncEndpoint(sub.endpoint) },
          "[push-dispatch] send failed (transient)",
        );
        stats.failed++;
      }
    }
  }

  if (toDelete.length > 0) {
    await db.delete(pushSubscriptions).where(
      and(
        eq(pushSubscriptions.userId, input.userId),
        inArray(pushSubscriptions.id, toDelete),
      ),
    );
  }
  if (toRefresh.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastSeenAt: new Date() })
      .where(inArray(pushSubscriptions.id, toRefresh));
  }

  return stats;
}

async function sendOne(sub: PushSubscriptionRow, payloadStr: string): Promise<void> {
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    },
    payloadStr,
    {
      // RFC 8030 urgency=normal (défaut). On laisse TTL au défaut web-push
      // (4 semaines) — pour ce type de notif (événement cosmique), c'est
      // bien plus que nécessaire mais sans risque.
    },
  );
}

function truncEndpoint(endpoint: string): string {
  // Loggue uniquement le host + un préfixe — l'endpoint complet contient
  // l'identifiant unique du device et n'a aucune valeur en log.
  try {
    const u = new URL(endpoint);
    return `${u.host}${u.pathname.slice(0, 16)}…`;
  } catch {
    return endpoint.slice(0, 32);
  }
}

// WEB-PUSH-V1 dispatch applied
