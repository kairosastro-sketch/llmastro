// ============================================================
// apps/web/public/sw.js
// WEB-PUSH-V1 + PWA-OFFLINE-V1 — Service Worker
// ------------------------------------------------------------
// Deux responsabilités, strictement séparées :
//   A) Push  : `push` + `notificationclick` (INCHANGÉ depuis WEB-PUSH-V1)
//   B) PWA   : cache offline minimal — network-first pour la navigation,
//              cache-first pour les assets immuables /_next/static/*.
//
// Règle d'or : on NE met JAMAIS en cache-first le HTML ni les données
// dynamiques (horoscopes, thèmes) → réseau d'abord, cache = filet offline.
//
// Servi en tant que fichier statique par Next (apps/web/public/ → /sw.js),
// donc PAS de bundling, PAS d'import ES module — code plat compatible
// service-worker. Scope = "/" (registré sans option, donc l'URL du SW
// dicte le scope).
// ============================================================

const CACHE = "llmastro-pwa-v1"; // bump ce nom à chaque changement de stratégie
const OFFLINE_URL = "/offline";

// --- INSTALL : pré-cache la page offline + skipWaiting -------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `cache: "reload"` → on récupère une version fraîche au moment de l'install,
      // pas une éventuelle copie du HTTP cache navigateur.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      // skipWaiting : la nouvelle version du SW prend la main immédiatement.
      await self.skipWaiting();
    })(),
  );
});

// --- ACTIVATE : purge les vieux caches + claim --------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// --- FETCH : stratégies offline -----------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // On ne touche qu'au GET same-origin. Le reste (POST API, cross-origin) passe direct.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // 1) Navigation (HTML) → NETWORK-FIRST, fallback page offline.
  //    Garantit qu'on ne sert jamais un horoscope/thème périmé.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (err) {
          const cache = await caches.open(CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return offline || Response.error();
        }
      })(),
    );
    return;
  }

  // 2) Assets immuables Next (/_next/static/*) → CACHE-FIRST (hashés, sûrs).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      })(),
    );
    return;
  }

  // 3) Tout le reste : on laisse le navigateur faire (réseau normal).
});

// ============================================================
// A) PUSH — INCHANGÉ depuis WEB-PUSH-V1
// ============================================================
self.addEventListener("push", (event) => {
  // L'API envoie un payload JSON ; en l'absence de payload, on affiche un
  // fallback générique plutôt que rien (sinon Chrome peut désactiver l'origine).
  let payload = {
    title: "Llmastro",
    body:  "Un nouvel événement cosmique.",
    url:   "/dashboard?notifs=open",
    tag:   "llmastro-default",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (err) {
      // Payload non-JSON (shouldn't happen avec notre API) — on garde le fallback.
    }
  }

  const options = {
    body:     payload.body || "",
    // icon/badge omis volontairement : le projet n'expose pas de PNG
    // standalone — Next sert le favicon dynamique via icon.tsx.
    tag:      payload.tag,
    renotify: false,
    data:     { url: payload.url || "/" },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Llmastro", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    // Si un onglet Llmastro est déjà ouvert, on le focus et on navigue
    // sans re-créer un onglet — moins intrusif et plus rapide.
    for (const client of allClients) {
      try {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      } catch (err) {
        // URL invalide → on ignore et on tombe sur openWindow.
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});

// WEB-PUSH-V1 + PWA-OFFLINE-V1 sw applied
