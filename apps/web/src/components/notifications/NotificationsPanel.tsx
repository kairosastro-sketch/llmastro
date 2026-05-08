// ============================================================
// apps/web/src/components/notifications/NotificationsPanel.tsx
// NOTIFICATIONS-V1-UI + DRAWER-PORTAL-FIX-V1
// ------------------------------------------------------------
// Drawer mobile-first qui glisse depuis la droite.
// Liste les notifications avec :
//   - état loading (spinner)
//   - état error (message simple)
//   - état empty (encart "aucune notif")
//   - liste paginée (Phase 1F : pagination par cursor)
//
// Fermeture : click sur overlay, bouton ×, ou touche Escape.
//
// IMPORTANT (DRAWER-PORTAL-FIX-V1) — rendu via createPortal sur
// document.body. Le button d'ouverture (NotificationBell) vit
// dans .topbar (backdrop-filter) ou dans DashboardTopbar
// (backdrop-filter aussi) ; ces ancêtres créent un containing
// block qui capturait le `position: fixed` du panel et le
// clippait à la hauteur du header (~56px). Le portal extrait
// l'arbre du panel hors de ces ancêtres pour qu'il se positionne
// par rapport au viewport.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNotificationsList } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { useApp } from "@/lib/i18n";

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: Props) {
  const { data, isLoading, error } = useNotificationsList();
  const { locale } = useApp();
  const [mounted, setMounted] = useState(false);

  // Portal mount : on attend l'hydratation côté client avant
  // de demander document.body (safe SSR).
  useEffect(() => {
    setMounted(true);
  }, []);


  // Fermer avec Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Bloque le scroll du body quand le drawer est ouvert
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const lang     = locale === "en" ? "en" : "fr";
  const t        = TRANSLATIONS[lang];
  const items    = data?.items ?? [];
  const isEmpty  = !isLoading && !error && items.length === 0;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset:    0,
          background: "rgba(0,0,0,.5)",
          zIndex:   50,
        }}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label={t.title}
        aria-modal="true"
        style={{
          position:        "fixed",
          top:             0,
          right:           0,
          bottom:          0,
          width:           "min(380px, 100vw)",
          background:      "var(--bg-2)",
          borderLeft:      "1px solid var(--border)",
          boxShadow:       "var(--shadow-float)",
          zIndex:          51,
          display:         "flex",
          flexDirection:   "column",
        }}
      >
        <header
          style={{
            padding:        "16px 20px",
            borderBottom:   "1px solid var(--border-soft)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            flexShrink:     0,
          }}
        >
          <h2
            style={{
              margin:     0,
              fontSize:   16,
              fontFamily: "var(--font-display, serif)",
              color:      "var(--star)",
              letterSpacing: ".5px",
            }}
          >
            {t.title}
            {data?.unreadCount ? (
              <span
                style={{
                  marginLeft:   8,
                  fontSize:     11,
                  color:        "var(--gold)",
                  fontWeight:   600,
                  fontFamily:   "inherit",
                }}
              >
                ({data.unreadCount} {t.unread})
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            style={{
              background: "none",
              border:     "none",
              color:      "var(--muted)",
              cursor:     "pointer",
              fontSize:   24,
              lineHeight: 1,
              padding:    4,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {isLoading && (
            <div
              style={{
                padding:    40,
                textAlign:  "center",
                color:      "var(--muted)",
              }}
            >
              <div className="spinner" />
            </div>
          )}

          {error && (
            <div
              style={{
                padding:    20,
                color:      "var(--tension)",
                textAlign:  "center",
                fontSize:   13,
              }}
            >
              {t.error}
            </div>
          )}

          {isEmpty && (
            <div
              style={{
                padding:    "60px 20px",
                color:      "var(--muted)",
                textAlign:  "center",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12, color: "var(--gold)" }}>✦</div>
              <div style={{ fontSize: 14, color: "var(--star)", marginBottom: 8 }}>
                {t.emptyTitle}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-2)", lineHeight: 1.5 }}>
                {t.emptyHint}
              </div>
            </div>
          )}

          {items.map((item) => (
            <NotificationItem key={item.id} item={item} onClose={onClose} />
          ))}
        </div>
      </aside>
    </>,
    document.body,
  );
}

const TRANSLATIONS = {
  fr: {
    title:      "Notifications",
    unread:     "non lue(s)",
    close:      "Fermer",
    error:      "Erreur de chargement",
    emptyTitle: "Aucune notification pour l'instant",
    emptyHint:  "Les évènements cosmiques personnalisés apparaîtront ici.",
  },
  en: {
    title:      "Notifications",
    unread:     "unread",
    close:      "Close",
    error:      "Failed to load",
    emptyTitle: "No notifications yet",
    emptyHint:  "Personalized cosmic events will appear here.",
  },
} as const;

// NOTIFICATIONS-V1-UI panel applied
