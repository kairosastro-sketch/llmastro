// ============================================================
// apps/web/src/components/notifications/NotificationItem.tsx
// NOTIFICATIONS-V1-UI + PAYLOAD-SHAPE-FIX-V1 + POLISH-V1
// ------------------------------------------------------------
// Item de la liste de notifications dans le drawer.
//
// Visuel :
//   - emoji selon kind (🌙 lunation / 🌑 eclipse / ✦ system)
//   - titre dérivé du payload :
//       * lunation : "Pleine Lune en Capricorne" (phase + signe)
//       * eclipse  : "Éclipse solaire" / "Éclipse lunaire"
//       * system   : data.title
//   - body : kairosText (texte LLM perso) pour sky_event, ou system.body
//   - date relative ("il y a 2 h" / "2h ago")
//   - bordure gauche dorée + bg surélevé si non lue
//
// Interaction (POLISH-V1) :
//   click → mark as read (optimistic) + close drawer + navigate
//   vers /dashboard/horoscope (la page du jour qui résume les
//   transits, contexte naturel pour creuser un événement cosmique).
// ============================================================

"use client";

import { useRouter } from "next/navigation";
import { useMarkNotificationRead } from "@/hooks/useNotifications";
import {
  ZODIAC_SIGN_LABELS,
  type HoroscopeDailyNotificationData,
  type NotificationData,
  type NotificationItemPayload,
  type SkyEventNotificationData,
  type SystemNotificationData,
} from "@/lib/api/notifications";
import { useApp } from "@/lib/i18n";

interface Props {
  item:    NotificationItemPayload;
  onClose: () => void;
}

function emojiFor(data: NotificationData): string {
  if (data.kind === "sky_event") {
    return data.eventType === "eclipse" ? "🌑" : "🌙";
  }
  if (data.kind === "horoscope_daily") return "☀";
  return "✦";
}

const HOROSCOPE_DAILY_TITLE = {
  fr: "Ton horoscope du jour",
  en: "Today's horoscope",
} as const;

const HOROSCOPE_DAILY_FALLBACK_BODY = {
  fr: "Ouvre l'app pour découvrir le ciel du jour.",
  en: "Open the app to read today's reading.",
} as const;

const LUNATION_PHASE_LABEL = {
  fr: {
    new:           "Nouvelle Lune",
    first_quarter: "Premier quartier",
    full:          "Pleine Lune",
    last_quarter:  "Dernier quartier",
  },
  en: {
    new:           "New Moon",
    first_quarter: "First Quarter",
    full:          "Full Moon",
    last_quarter:  "Last Quarter",
  },
} as const;

const ECLIPSE_KIND_LABEL = {
  fr: { solar: "Éclipse solaire", lunar: "Éclipse lunaire" },
  en: { solar: "Solar eclipse",   lunar: "Lunar eclipse"   },
} as const;

const ECLIPSE_MAGNITUDE_LABEL = {
  fr: { total: "totale",  partial: "partielle", marginal: "marginale" },
  en: { total: "total",   partial: "partial",   marginal: "marginal"  },
} as const;

const FALLBACK_BODY = {
  fr: "Événement cosmique personnalisé",
  en: "Personalized cosmic event",
} as const;

function titleFor(data: NotificationData, lang: "fr" | "en"): string {
  if (data.kind === "system") {
    return (data as SystemNotificationData).title;
  }
  if (data.kind === "horoscope_daily") {
    return HOROSCOPE_DAILY_TITLE[lang];
  }
  const sky = data as SkyEventNotificationData;
  if (sky.event.type === "lunation") {
    const phase = LUNATION_PHASE_LABEL[lang][sky.event.phase];
    const signIndex = sky.event.sign;
    if (signIndex >= 0 && signIndex < 12) {
      const sign = ZODIAC_SIGN_LABELS[lang][signIndex];
      return lang === "fr" ? `${phase} en ${sign}` : `${phase} in ${sign}`;
    }
    return phase;
  }
  // Eclipse — base label + magnitude qualitative + signe si présents.
  // Anciennes notifs en DB n'ont ni magnitude ni sign (champs Phase 1G+).
  const base    = ECLIPSE_KIND_LABEL[lang][sky.event.kind];
  const mag     = sky.event.magnitude;
  const signIdx = sky.event.sign;
  let title = mag ? `${base} ${ECLIPSE_MAGNITUDE_LABEL[lang][mag]}` : base;
  if (signIdx != null && signIdx >= 0 && signIdx < 12) {
    const sign = ZODIAC_SIGN_LABELS[lang][signIdx];
    title += lang === "fr" ? ` en ${sign}` : ` in ${sign}`;
  }
  return title;
}

function bodyFor(data: NotificationData, lang: "fr" | "en"): string {
  if (data.kind === "system") {
    return (data as SystemNotificationData).body;
  }
  if (data.kind === "horoscope_daily") {
    const k = (data as HoroscopeDailyNotificationData).body;
    if (!k) return HOROSCOPE_DAILY_FALLBACK_BODY[lang];
    if (typeof k === "string") return k.trim() || HOROSCOPE_DAILY_FALLBACK_BODY[lang];
    const other = lang === "fr" ? "en" : "fr";
    return k[lang]?.trim() || k[other]?.trim() || HOROSCOPE_DAILY_FALLBACK_BODY[lang];
  }
  const sky = data as SkyEventNotificationData;
  const k = sky.kairosText;
  if (!k) return FALLBACK_BODY[lang];

  // Legacy : ancien format mono-langue (string). Pas de garantie sur la langue
  // d'origine ; on l'affiche tel quel — c'était déjà le comportement avant
  // bilinguer, et le cap=10 fait rouler ces rows en quelques jours.
  if (typeof k === "string") return k.trim() || FALLBACK_BODY[lang];

  // Nouveau format bilingue : préfère la langue user, sinon l'autre (la
  // traduction LLM peut avoir échoué au dispatch → on tombe sur la canonique),
  // sinon fallback déterministe.
  const other = lang === "fr" ? "en" : "fr";
  return k[lang]?.trim() || k[other]?.trim() || FALLBACK_BODY[lang];
}

function formatRelative(iso: string, locale: "fr" | "en"): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(ms / 60_000);
  const hour = Math.floor(ms / 3_600_000);
  const day  = Math.floor(ms / 86_400_000);

  if (locale === "fr") {
    if (min < 1)   return "à l'instant";
    if (min < 60)  return `il y a ${min} min`;
    if (hour < 24) return `il y a ${hour} h`;
    if (day < 7)   return `il y a ${day} j`;
    return new Date(iso).toLocaleDateString("fr-FR");
  }
  if (min < 1)   return "just now";
  if (min < 60)  return `${min}m ago`;
  if (hour < 24) return `${hour}h ago`;
  if (day < 7)   return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US");
}

export function NotificationItem({ item, onClose }: Props) {
  const { locale } = useApp();
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  const isUnread = !item.readAt;

  const lang  = locale === "en" ? "en" : "fr";
  const title = titleFor(item.data, lang);
  const body  = bodyFor(item.data, lang);

  const handleClick = () => {
    if (isUnread) {
      markRead.mutate(item.id);
    }
    onClose();
    router.push("/dashboard/horoscope");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display:      "flex",
        gap:          12,
        padding:      "14px 20px",
        background:   isUnread ? "var(--bg-raised)" : "transparent",
        borderTop:    "none",
        borderRight:  "none",
        borderBottom: "1px solid var(--border-soft)",
        borderLeft:   isUnread ? "3px solid var(--gold)" : "3px solid transparent",
        cursor:       "pointer",
        textAlign:    "left",
        width:        "100%",
        color:        "var(--star)",
      }}
      aria-label={isUnread
        ? (lang === "fr" ? "Marquer comme lu et ouvrir l'horoscope du jour" : "Mark as read and open today's horoscope")
        : (lang === "fr" ? "Ouvrir l'horoscope du jour" : "Open today's horoscope")
      }
    >
      <div style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }} aria-hidden="true">
        {emojiFor(item.data)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize:     14,
            fontWeight:   isUnread ? 600 : 400,
            marginBottom: 4,
            color:        "var(--star)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize:     13,
            color:        "var(--muted)",
            lineHeight:   1.4,
            marginBottom: 6,
          }}
        >
          {body}
        </div>
        <div
          style={{
            fontSize: 11,
            color:    "var(--muted-2)",
          }}
        >
          {formatRelative(item.createdAt, lang)}
        </div>
      </div>
    </button>
  );
}

// NOTIFICATIONS-V1-UI item applied
// PAYLOAD-SHAPE-FIX-V1 applied
// POLISH-V1 applied (sign in title + close + nav)
