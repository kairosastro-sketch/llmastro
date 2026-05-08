// ============================================================
// apps/web/src/components/notifications/NotificationBell.tsx
// NOTIFICATIONS-V1-UI
// ------------------------------------------------------------
// Icône cloche avec badge unread count, intégrée au MobileHeader.
//
// - SVG inline (pas de dépendance ajoutée).
// - Badge rouge en haut à droite avec count (max "99+").
// - Click ouvre le NotificationsPanel.
// - aria-expanded pour les SR.
// ============================================================

"use client";

import { useState } from "react";
import { useNotificationsList } from "@/hooks/useNotifications";
import { NotificationsPanel } from "./NotificationsPanel";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotificationsList();
  const unread = data?.unreadCount ?? 0;

  return (
    <>
      <button
        type="button"
        className="tb-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ""}`}
        aria-expanded={open}
        style={{ position: "relative" }}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position:       "absolute",
              top:            -3,
              right:          -3,
              minWidth:       16,
              height:         16,
              padding:        "0 4px",
              borderRadius:   8,
              background:     "var(--tension)",
              color:          "#fff",
              fontSize:       10,
              fontWeight:     600,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              border:         "1.5px solid var(--bg)",
              lineHeight:     1,
              boxSizing:      "border-box",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <NotificationsPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function BellIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// NOTIFICATIONS-V1-UI bell applied
