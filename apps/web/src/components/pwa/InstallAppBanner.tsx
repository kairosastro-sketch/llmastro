// ============================================================
// apps/web/src/components/pwa/InstallAppBanner.tsx
// PWA-INSTALL-V1
// ------------------------------------------------------------
// Bannière in-app discrète qui propose d'installer Llmastro en PWA.
//
// Deux chemins selon la plateforme :
//   • Chromium (Android / desktop) → capture l'event `beforeinstallprompt`,
//     affiche un bouton « Installer » qui déclenche le prompt natif.
//   • iOS Safari → pas d'event possible : on affiche les instructions
//     « Partager → Sur l'écran d'accueil ».
//
// Conditions de masquage :
//   - déjà installée (display-mode: standalone / navigator.standalone)
//   - bannière dismissée (localStorage)
//   - navigateur sans support install (Firefox desktop, etc.) ET non-iOS
//
// Style « Céleste » soft, aligné sur PushEnableBanner. Inline styles +
// var(--*) uniquement (aucune classe blacklistée, cf. lint-forbidden-classes).
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/i18n";

// L'event n'est pas encore dans les types DOM standard.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "llmastro:install-banner-dismissed";

// « Plus tard » = snooze, pas un masquage définitif. Le délai s'allonge à
// chaque report (rappel régulier mais non intrusif), puis se stabilise à 30j
// → la bannière revient ~1×/mois tant que l'app n'est pas installée.
const SNOOZE_STEPS_DAYS = [3, 7, 14, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

// Lit l'état de snooze. Retourne true si on est encore dans la fenêtre de
// silence. Tolère l'ancien format ("1", masquage définitif) en le traitant
// comme expiré → migration douce vers le nouveau comportement.
function isSnoozed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const { at, count } = JSON.parse(raw) as { at: number; count: number };
    if (typeof at !== "number" || typeof count !== "number") return false;
    const stepIdx = Math.min(count - 1, SNOOZE_STEPS_DAYS.length - 1);
    const cooldown = SNOOZE_STEPS_DAYS[Math.max(0, stepIdx)] * DAY_MS;
    return Date.now() - at < cooldown;
  } catch {
    return false;
  }
}

function recordSnooze() {
  if (typeof window === "undefined") return;
  try {
    let count = 0;
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (raw) {
      try {
        count = (JSON.parse(raw) as { count?: number }).count ?? 0;
      } catch {
        count = 0;
      }
    }
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify({ at: Date.now(), count: count + 1 }));
  } catch {
    // best-effort
  }
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari expose navigator.standalone (non standard)
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  // iPadOS 13+ se présente en "Macintosh" → on teste aussi le touch.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && "ontouchend" in window)
  );
}

export function InstallAppBanner() {
  const { locale } = useApp();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => isSnoozed());

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true);
      return;
    }
    setIos(isIOS());

    const onBIP = (e: Event) => {
      // On empêche le mini-infobar Chrome par défaut pour piloter l'UI nous-mêmes.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const lang = locale === "en" ? "en" : "fr";
  const t = TRANSLATIONS[lang];

  // Garde-fous d'affichage.
  if (installed) return null;
  if (dismissed) return null;
  // Chromium : on attend l'event. iOS : on affiche les instructions.
  if (!deferred && !ios) return null;

  function handleDismiss() {
    recordSnooze();
    setDismissed(true);
  }

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    // Une fois consommé, l'event n'est plus réutilisable.
    setDeferred(null);
    if (choice.outcome === "accepted") setInstalled(true);
  }

  return (
    <aside
      role="region"
      aria-label={t.aria}
      style={{
        position: "relative",
        margin: "12px 16px 0",
        padding: "12px 14px 12px 16px",
        borderRadius: 12,
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--shadow-soft)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 13,
        color: "var(--star)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--glow-violet) 0%, transparent 70%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--gold)",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ✦
      </div>

      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        <div style={{ fontWeight: 500 }}>{t.title}</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
          {ios ? t.iosBody : t.body}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {/* iOS n'a pas de prompt natif → seulement le bouton « Plus tard ». */}
        {deferred && (
          <button
            type="button"
            onClick={() => void handleInstall()}
            style={{
              background: "var(--gold)",
              color: "var(--bg-2)",
              border: "1px solid var(--gold)",
              borderRadius: 999,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.install}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t.dismissAria}
          style={{
            background: "transparent",
            color: "var(--muted)",
            border: "1px solid var(--border-soft)",
            borderRadius: 999,
            padding: "5px 10px",
            fontSize: 12,
            cursor: "pointer",
            whiteSpace: "nowrap",
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
    aria: "Installer l'application Llmastro",
    title: "Installe Llmastro sur ton appareil",
    body: "Accès direct depuis l'écran d'accueil, plein écran, même hors-ligne.",
    iosBody: "Touche « Partager » puis « Sur l'écran d'accueil » pour installer.",
    install: "Installer",
    dismiss: "Plus tard",
    dismissAria: "Masquer cette bannière",
  },
  en: {
    aria: "Install the Llmastro app",
    title: "Install Llmastro on your device",
    body: "Launch it from your home screen, full-screen, even offline.",
    iosBody: "Tap “Share”, then “Add to Home Screen” to install.",
    install: "Install",
    dismiss: "Later",
    dismissAria: "Dismiss this banner",
  },
} as const;

// PWA-INSTALL-V1 banner applied
