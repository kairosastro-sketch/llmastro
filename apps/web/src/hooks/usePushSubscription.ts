// ============================================================
// apps/web/src/hooks/usePushSubscription.ts
// WEB-PUSH-V1
// ------------------------------------------------------------
// Hook React qui gère le cycle de vie d'une Web Push subscription :
//
//   1) detection support navigateur (serviceWorker + PushManager + Notification)
//   2) lecture de l'état permission (Notification.permission)
//   3) register du SW /sw.js et lecture de la subscription existante
//   4) subscribe(applicationServerKey=VAPID_PUBLIC_KEY) + POST API
//   5) unsubscribe() symétrique
//
// Le hook expose un état { isSupported, permission, status, error,
// subscription } et 2 actions { enable, disable }.
//
// `status` reflète le pipeline réel, pas juste la permission navigateur :
//   - "unsupported"   : navigateur sans support push (Safari < 16.4 desktop, etc.)
//   - "not-configured": l'API n'a pas de VAPID (admin pas configuré → on cache l'UI)
//   - "denied"        : l'user a refusé la permission (permanent jusqu'au reset)
//   - "idle"          : tout dispo, pas encore opt-in
//   - "subscribing"   : en cours d'abonnement
//   - "subscribed"    : actif
//   - "unsubscribing" : en cours de désabonnement
//   - "error"         : échec quelque part (cf. `error`)
// ============================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { notificationsApi } from "@/lib/api/notifications";

type Status =
  | "loading"
  | "unsupported"
  | "not-configured"
  | "denied"
  | "idle"
  | "subscribing"
  | "subscribed"
  | "unsubscribing"
  | "error";

interface PushState {
  isSupported: boolean;
  permission:  NotificationPermission | "default";
  status:      Status;
  error:       string | null;
  /** Endpoint courant (pour debug/affichage "désactiver cet appareil"). */
  endpoint:    string | null;
  vapidPublicKey: string | null;
}

const SERVICE_WORKER_URL = "/sw.js";

function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager"   in window &&
    "Notification"  in window
  );
}

// VAPID public key en base64url → Uint8Array (format attendu par
// PushManager.subscribe). Inline et sans dépendance — ~15 lignes.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  const out     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function subscriptionToWire(sub: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const json = sub.toJSON();
  const keys = (json.keys ?? {}) as { p256dh?: string; auth?: string };
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    keys: {
      p256dh: keys.p256dh ?? "",
      auth:   keys.auth   ?? "",
    },
  };
}

export function usePushSubscription() {
  const { accessToken } = useAuth();

  const [state, setState] = useState<PushState>({
    isSupported:    false,
    permission:     "default",
    status:         "loading",
    error:          null,
    endpoint:       null,
    vapidPublicKey: null,
  });

  // ──────────────────────────────────────────────────────────
  // Init : détecte le support, lit la config API, lit l'état SW courant
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supported = isPushSupported();
      if (!supported) {
        if (!cancelled) {
          setState((s) => ({ ...s, isSupported: false, status: "unsupported" }));
        }
        return;
      }

      // L'utilisateur doit être logué pour qu'on appelle l'API config.
      // Sans token, on reste en "loading" jusqu'à ce que le token apparaisse.
      if (!accessToken) {
        if (!cancelled) {
          setState((s) => ({ ...s, isSupported: true, status: "loading" }));
        }
        return;
      }

      let vapidPublicKey: string | null = null;
      let configured = false;

      // 1) Lit la config VAPID côté API. Si l'admin n'a pas set VAPID_PRIVATE_KEY,
      //    on cache l'opt-in (pas de subscribe possible côté serveur).
      try {
        const res = await notificationsApi.getPushConfig(accessToken);
        if (res.success) {
          configured     = res.data.configured;
          vapidPublicKey = res.data.publicKey || null;
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isSupported: true,
            status: "error",
            error: err instanceof Error ? err.message : "Failed to read push config",
          }));
        }
        return;
      }

      // Fallback : si l'API ne renvoie pas la clé (cas legacy), on lit
      // NEXT_PUBLIC_VAPID_PUBLIC_KEY inliné au build.
      if (!vapidPublicKey) {
        vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
      }

      if (!configured || !vapidPublicKey) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isSupported:    true,
            status:         "not-configured",
            vapidPublicKey: null,
          }));
        }
        return;
      }

      // 2) Register du SW (idempotent — si déjà register, le navigateur retourne
      //    la registration existante sans rien re-télécharger).
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isSupported: true,
            status: "error",
            error: err instanceof Error ? err.message : "Failed to register service worker",
            vapidPublicKey,
          }));
        }
        return;
      }

      // 3) Lit la subscription courante (si l'user avait déjà opt-in).
      const existing = await registration.pushManager.getSubscription();
      const permission = (typeof Notification !== "undefined"
        ? Notification.permission
        : "default") as NotificationPermission | "default";

      if (cancelled) return;

      if (permission === "denied") {
        setState({
          isSupported: true,
          permission,
          status:      "denied",
          error:       null,
          endpoint:    existing?.endpoint ?? null,
          vapidPublicKey,
        });
        return;
      }

      setState({
        isSupported:    true,
        permission,
        status:         existing ? "subscribed" : "idle",
        error:          null,
        endpoint:       existing?.endpoint ?? null,
        vapidPublicKey,
      });
    }

    void init();
    return () => { cancelled = true; };
  }, [accessToken]);

  // ──────────────────────────────────────────────────────────
  // Action : opt-in
  // ──────────────────────────────────────────────────────────
  const enable = useCallback(async () => {
    if (!accessToken)                       return;
    if (!state.isSupported)                 return;
    if (!state.vapidPublicKey)              return;
    if (state.status === "subscribing")     return;

    setState((s) => ({ ...s, status: "subscribing", error: null }));

    try {
      // L'appel à Notification.requestPermission DOIT être dans un handler
      // d'event utilisateur direct (click), pas dans un useEffect.
      // C'est pourquoi `enable()` est exposée et appelée depuis le bouton.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((s) => ({
          ...s,
          status:     permission === "denied" ? "denied" : "idle",
          permission,
        }));
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      // TS5 a rendu Uint8Array générique sur ArrayBufferLike (vs. ArrayBuffer),
      // ce qui casse l'assignation directe vers BufferSource. Le cast est
      // sûr : le buffer sous-jacent est un ArrayBuffer concret créé par
      // `new Uint8Array(length)`, jamais un SharedArrayBuffer.
      const applicationServerKey =
        urlBase64ToUint8Array(state.vapidPublicKey) as unknown as BufferSource;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // requis par tous les navigateurs modernes
        applicationServerKey,
      });

      const wire = subscriptionToWire(subscription);
      const res  = await notificationsApi.pushSubscribe(accessToken, wire);
      if (!res.success) {
        throw new Error("API rejected subscription");
      }

      // Met aussi à jour les prefs côté serveur (notify_push=true) — sinon
      // le dispatcher ne pushera rien même avec une sub valide.
      await notificationsApi.updatePrefs(accessToken, { notify_push: true });

      setState((s) => ({
        ...s,
        status:     "subscribed",
        permission: "granted",
        endpoint:   subscription.endpoint,
        error:      null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error:  err instanceof Error ? err.message : "Failed to subscribe",
      }));
    }
  }, [accessToken, state.isSupported, state.status, state.vapidPublicKey]);

  // ──────────────────────────────────────────────────────────
  // Action : opt-out
  // ──────────────────────────────────────────────────────────
  const disable = useCallback(async () => {
    if (!accessToken)                  return;
    if (!state.isSupported)            return;
    if (state.status !== "subscribed") return;

    setState((s) => ({ ...s, status: "unsubscribing", error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint ?? state.endpoint;

      if (endpoint) {
        // Best-effort : on DELETE côté API avant d'unsubscribe côté navigateur
        // (l'inverse créerait une fenêtre où l'endpoint en DB est orphelin).
        // On ignore le 404 — c'est OK, ça veut dire que c'est déjà parti.
        try {
          await notificationsApi.pushUnsubscribe(accessToken, endpoint);
        } catch {
          // ignore — l'unsubscribe local va de toute façon le déconnecter
        }
      }

      if (subscription) {
        await subscription.unsubscribe();
      }

      await notificationsApi.updatePrefs(accessToken, { notify_push: false });

      setState((s) => ({
        ...s,
        status:   "idle",
        endpoint: null,
        error:    null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error:  err instanceof Error ? err.message : "Failed to unsubscribe",
      }));
    }
  }, [accessToken, state.endpoint, state.isSupported, state.status]);

  return { ...state, enable, disable };
}

// WEB-PUSH-V1 hook applied
