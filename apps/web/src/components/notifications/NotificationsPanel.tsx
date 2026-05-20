// ============================================================
// apps/web/src/components/notifications/NotificationsPanel.tsx
// NOTIFICATIONS-V1-UI + DRAWER-PORTAL-FIX-V1
// ------------------------------------------------------------
// Drawer mobile-first qui glisse depuis la droite.
// Liste les notifications avec :
//   - état loading (spinner)
//   - état error (message simple)
//   - état empty (encart "aucune notif")
//   - liste plate (cap 10/user appliqué côté backend, pas de pagination)
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

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  useClearAllNotifications,
  useMarkAllNotificationsRead,
  useNotificationsList,
} from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import type { NotificationItemPayload } from "@/lib/api/notifications";
import { useApp } from "@/lib/i18n";

interface Props {
  open:    boolean;
  onClose: () => void;
}

type Filter = "all" | "lunations" | "eclipses" | "system";

function matchesFilter(item: NotificationItemPayload, filter: Filter): boolean {
  if (filter === "all")    return true;
  if (filter === "system") return item.data.kind === "system";
  if (item.data.kind !== "sky_event") return false;
  if (filter === "lunations") return item.data.event.type === "lunation";
  return item.data.event.type === "eclipse";
}

export function NotificationsPanel({ open, onClose }: Props) {
  const { data, isLoading, error } = useNotificationsList();
  const markAllRead = useMarkAllNotificationsRead();
  const clearAll    = useClearAllNotifications();
  const { locale } = useApp();
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter]   = useState<Filter>("all");

  // Portal mount : on attend l'hydratation côté client avant
  // de demander document.body (safe SSR).
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset filter à chaque ouverture pour ne pas masquer une nouvelle
  // notif si l'utilisateur avait laissé un filtre actif lors d'une
  // session précédente.
  useEffect(() => {
    if (open) setFilter("all");
  }, [open]);

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

  const items = useMemo(() => data?.items ?? [], [data]);

  // Counts par catégorie pour les pills (max 10 items donc trivial).
  const counts = useMemo(() => ({
    all:       items.length,
    lunations: items.filter((it) => matchesFilter(it, "lunations")).length,
    eclipses:  items.filter((it) => matchesFilter(it, "eclipses")).length,
    system:    items.filter((it) => matchesFilter(it, "system")).length,
  }), [items]);

  const filteredItems = useMemo(
    () => items.filter((it) => matchesFilter(it, filter)),
    [items, filter],
  );

  if (!open || !mounted) return null;

  const lang            = locale === "en" ? "en" : "fr";
  const t               = TRANSLATIONS[lang];
  const isEmpty         = !isLoading && !error && items.length === 0;
  const isFilteredEmpty = !isLoading && !error && items.length > 0 && filteredItems.length === 0;

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
            padding:        "16px 20px 12px",
            borderBottom:   "1px solid var(--border-soft)",
            display:        "flex",
            flexDirection:  "column",
            gap:            8,
            flexShrink:     0,
          }}
        >
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
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
          </div>

          {/* Sub-row : actions discrètes (mark-all-read + lien prefs) */}
          <div
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        14,
              fontSize:   12,
              color:      "var(--muted)",
            }}
          >
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={!data || data.unreadCount === 0 || markAllRead.isPending}
              style={{
                background:    "none",
                border:        "none",
                padding:       0,
                color:         data?.unreadCount ? "var(--gold)" : "var(--muted-2)",
                cursor:        data?.unreadCount ? "pointer" : "default",
                fontSize:      "inherit",
                textDecoration: "none",
              }}
            >
              {t.markAllRead}
            </button>
            <span style={{ color: "var(--muted-2)" }}>·</span>
            <button
              type="button"
              onClick={() => {
                if (items.length === 0) return;
                // Confirmation native — pas de modal infra dans le projet,
                // l'action est destructive et irréversible côté DB (hard delete).
                if (window.confirm(t.clearAllConfirm)) {
                  clearAll.mutate();
                }
              }}
              disabled={items.length === 0 || clearAll.isPending}
              style={{
                background:     "none",
                border:         "none",
                padding:        0,
                color:          items.length > 0 ? "var(--tension)" : "var(--muted-2)",
                cursor:         items.length > 0 ? "pointer" : "default",
                fontSize:       "inherit",
                textDecoration: "none",
                opacity:        clearAll.isPending ? 0.5 : 1,
              }}
            >
              {t.clearAll}
            </button>
            <span style={{ color: "var(--muted-2)" }}>·</span>
            <Link
              href="/dashboard/notifications/preferences"
              onClick={onClose}
              style={{
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              {t.preferences}
            </Link>
          </div>

          {/* Filter pills — masquées tant qu'il n'y a pas de notifs (les
              counts sont tous 0, l'UI est inutile). */}
          {items.length > 0 && (
            <div
              role="tablist"
              aria-label={t.filterAriaLabel}
              style={{
                display:   "flex",
                gap:       6,
                flexWrap:  "wrap",
                marginTop: 4,
              }}
            >
              {(["all", "lunations", "eclipses", "system"] as const).map((key) => {
                const active = filter === key;
                const count  = counts[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(key)}
                    style={{
                      background:   active ? "var(--gold)" : "var(--bg-raised)",
                      color:        active ? "var(--bg-2)" : "var(--muted)",
                      border:       active ? "1px solid var(--gold)" : "1px solid var(--border-soft)",
                      borderRadius: 999,
                      padding:      "3px 10px",
                      fontSize:     11,
                      fontWeight:   active ? 600 : 400,
                      cursor:       "pointer",
                      lineHeight:   1.4,
                    }}
                  >
                    {t.filters[key]} {count > 0 ? `(${count})` : ""}
                  </button>
                );
              })}
            </div>
          )}
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

          {isFilteredEmpty && (
            <div
              style={{
                padding:    "40px 20px",
                color:      "var(--muted)",
                textAlign:  "center",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                {t.emptyFilteredTitle}
              </div>
              <button
                type="button"
                onClick={() => setFilter("all")}
                style={{
                  background:     "none",
                  border:         "none",
                  padding:        0,
                  color:          "var(--gold)",
                  cursor:         "pointer",
                  fontSize:       12,
                  textDecoration: "underline",
                }}
              >
                {t.emptyFilteredAction}
              </button>
            </div>
          )}

          {filteredItems.map((item) => (
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
    title:                "Notifications",
    unread:               "non lue(s)",
    close:                "Fermer",
    error:                "Erreur de chargement",
    emptyTitle:           "Aucune notification pour l'instant",
    emptyHint:            "Les évènements cosmiques personnalisés apparaîtront ici.",
    markAllRead:          "Tout marquer lu",
    clearAll:             "Effacer tout",
    clearAllConfirm:      "Effacer toutes les notifications ? Cette action est irréversible.",
    preferences:          "⚙ Préférences",
    filterAriaLabel:      "Filtrer par catégorie",
    filters: {
      all:       "Toutes",
      lunations: "Lunaisons",
      eclipses:  "Éclipses",
      system:    "Système",
    },
    emptyFilteredTitle:   "Rien dans cette catégorie",
    emptyFilteredAction:  "Voir tout",
  },
  en: {
    title:                "Notifications",
    unread:               "unread",
    close:                "Close",
    error:                "Failed to load",
    emptyTitle:           "No notifications yet",
    emptyHint:            "Personalized cosmic events will appear here.",
    markAllRead:          "Mark all as read",
    clearAll:             "Clear all",
    clearAllConfirm:      "Clear all notifications? This cannot be undone.",
    preferences:          "⚙ Preferences",
    filterAriaLabel:      "Filter by category",
    filters: {
      all:       "All",
      lunations: "Lunations",
      eclipses:  "Eclipses",
      system:    "System",
    },
    emptyFilteredTitle:   "Nothing in this category",
    emptyFilteredAction:  "Show all",
  },
} as const;

// NOTIFICATIONS-V1-UI panel applied
// PHASE-1F panel header actions applied
