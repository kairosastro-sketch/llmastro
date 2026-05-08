// ============================================================
// apps/web/src/components/notifications/NotificationItem.tsx
// NOTIFICATIONS-V1-UI
// ------------------------------------------------------------
// Item de la liste de notifications dans le drawer.
//
// Visuel :
//   - emoji selon kind (🌙 lunation, 🌑 eclipse, ✦ system)
//   - titre (gras si non lue)
//   - body (1-2 lignes)
//   - date relative ("il y a 2h" / "2h ago")
//   - bordure gauche dorée si non lue
//   - background légèrement surélevé si non lue
//
// Interaction : click → mark as read (optimistic).
// La nav vers la page d'event source est laissée pour Phase 1F :
// ici on marque juste comme lu, le user peut revenir au drawer.
// ============================================================

"use client";

import { useMarkNotificationRead } from "@/hooks/useNotifications";
import type {
  NotificationData,
  NotificationItemPayload,
} from "@/lib/api/notifications";
import { useApp } from "@/lib/i18n";

interface Props {
  item: NotificationItemPayload;
}

const KIND_EMOJI: Record<string, string> = {
  lunation: "🌙",
  eclipse:  "🌑",
  system:   "✦",
};

function emojiFor(data: NotificationData): string {
  if (data.kind === "sky_event") {
    return KIND_EMOJI[data.eventType] ?? "✦";
  }
  return KIND_EMOJI.system;
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

export function NotificationItem({ item }: Props) {
  const { locale } = useApp();
  const markRead = useMarkNotificationRead();
  const isUnread = !item.readAt;

  const lang  = locale === "en" ? "en" : "fr";
  const title = item.data.title?.[lang] ?? item.data.title?.fr ?? "";
  const body  = item.data.body?.[lang]  ?? item.data.body?.fr  ?? "";

  const handleClick = () => {
    if (isUnread) {
      markRead.mutate(item.id);
    }
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
      aria-label={isUnread ? "Marquer comme lu" : undefined}
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
