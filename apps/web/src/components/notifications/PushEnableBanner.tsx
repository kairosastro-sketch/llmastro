// ============================================================
// apps/web/src/components/notifications/PushEnableBanner.tsx
// WEB-PUSH-V1
// ------------------------------------------------------------
// Bannière in-app discrète qui propose d'activer les push browser.
//
// Conditions d'affichage (TOUTES requises) :
//   1) Web Push supporté par le navigateur
//   2) VAPID configuré côté API
//   3) prefs.notify_push !== true (pas déjà opt-in)
//   4) Notification.permission !== "denied" (sinon inutile)
//   5) L'user a déjà reçu ≥1 notif in-app (sinon prématuré)
//   6) Bannière pas dismissée (localStorage)
//
// Style : « Céleste » soft — encart violet/or sur fond raised, pas de
// neon. S'insère dans le dashboard layout entre la topbar et le content.
//
// Aucune CSS class blacklistée (cf. lint-forbidden-classes), uniquement
// inline styles + var(--*). Cohérent avec NotificationsPanel.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/i18n";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import {
  useNotificationsList,
  useNotificationPreferences,
} from "@/hooks/useNotifications";

const DISMISSED_KEY = "llmastro:push-banner-dismissed";

export function PushEnableBanner() {
  const { locale } = useApp();
  const { data: notifData } = useNotificationsList();
  const { data: prefs }     = useNotificationPreferences();
  const push = usePushSubscription();

  // Dismissal state — synchronisé avec localStorage. Lecture en lazy
  // initializer pour éviter un flicker au mount (la banner apparaît
  // puis disparaît si le flag est set).
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Si l'user s'est désabonné (status revient à "idle"), on ré-affiche la
  // bannière même si elle avait été dismissée précédemment — sinon il n'y
  // a plus d'UI pour réactiver tant qu'il n'est pas allé dans /preferences.
  // On reset le flag à chaque transition vers "subscribed" / "denied" qui
  // sont des états terminaux.
  useEffect(() => {
    if (push.status === "subscribed" || push.status === "denied") {
      try {
        window.localStorage.removeItem(DISMISSED_KEY);
      } catch {
        // best-effort
      }
    }
  }, [push.status]);

  const hasReceivedNotifs = (notifData?.items.length ?? 0) > 0;
  const alreadyOptedIn    = prefs?.notify_push === true;

  // Garde-fous : conditions cumulées pour show.
  if (dismissed)                              return null;
  if (!hasReceivedNotifs)                     return null;
  if (alreadyOptedIn)                         return null;
  if (push.status === "loading")              return null;
  if (push.status === "unsupported")          return null;
  if (push.status === "not-configured")       return null;
  if (push.status === "denied")               return null;
  if (push.status === "subscribed")           return null;
  // À ce stade : status = "idle" | "subscribing" | "unsubscribing" | "error"

  const lang = locale === "en" ? "en" : "fr";
  const t    = TRANSLATIONS[lang];

  const isBusy = push.status === "subscribing";

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore — la bannière reviendra au prochain mount sans persistance
    }
    setDismissed(true);
  }

  return (
    <aside
      role="region"
      aria-label={t.aria}
      style={{
        position:     "relative",
        margin:       "12px 16px 0",
        padding:      "12px 14px 12px 16px",
        borderRadius: 12,
        background:   "var(--card-bg)",
        border:       "1px solid var(--card-border)",
        boxShadow:    "var(--shadow-soft)",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        fontSize:     13,
        color:        "var(--star)",
      }}
    >
      {/* Pastille décorative — pas neon, juste un point doré sur halo violet */}
      <div
        aria-hidden="true"
        style={{
          flexShrink:   0,
          width:        32,
          height:       32,
          borderRadius: "50%",
          background:   "radial-gradient(circle, var(--glow-violet) 0%, transparent 70%)",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          color:        "var(--gold)",
          fontSize:     18,
          lineHeight:   1,
        }}
      >
        ✦
      </div>

      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        <div style={{ fontWeight: 500 }}>{t.title}</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
          {t.body}
        </div>
        {push.status === "error" && push.error && (
          <div style={{ color: "var(--tension)", fontSize: 11, marginTop: 4 }}>
            {push.error}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => void push.enable()}
          disabled={isBusy}
          style={{
            background:   "var(--gold)",
            color:        "var(--bg-2)",
            border:       "1px solid var(--gold)",
            borderRadius: 999,
            padding:      "5px 12px",
            fontSize:     12,
            fontWeight:   600,
            cursor:       isBusy ? "default" : "pointer",
            opacity:      isBusy ? 0.6 : 1,
            whiteSpace:   "nowrap",
          }}
        >
          {isBusy ? t.enabling : t.enable}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t.dismissAria}
          style={{
            background:   "transparent",
            color:        "var(--muted)",
            border:       "1px solid var(--border-soft)",
            borderRadius: 999,
            padding:      "5px 10px",
            fontSize:     12,
            cursor:       "pointer",
            whiteSpace:   "nowrap",
          }}
        >
          {t.dismiss}
        </button>
      </div>
    </aside>
  );
}

const TRANSLATIONS = {
  fr: {
    aria:        "Activer les notifications navigateur",
    title:       "Reçois tes notifications cosmiques en direct",
    body:        "Active les push pour être prévenu·e dès qu'un événement résonne avec ton thème.",
    enable:      "Activer",
    enabling:    "Activation…",
    dismiss:     "Plus tard",
    dismissAria: "Masquer cette bannière",
  },
  en: {
    aria:        "Enable browser notifications",
    title:       "Get your cosmic moments in real time",
    body:        "Enable push notifications to be alerted when an event resonates with your chart.",
    enable:      "Enable",
    enabling:    "Enabling…",
    dismiss:     "Later",
    dismissAria: "Dismiss this banner",
  },
} as const;

// WEB-PUSH-V1 banner applied
