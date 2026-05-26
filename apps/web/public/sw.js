// ============================================================
// apps/web/public/sw.js
// WEB-PUSH-V1 — Service Worker minimal (push uniquement)
// ------------------------------------------------------------
// Pas de PWA full / pas de précaching / pas d'interception fetch.
// Ce SW gère exclusivement deux events :
//
//   1) `push`              — réception d'un Web Push, affiche la notif
//   2) `notificationclick` — au clic, ouvre/focus le deeplink fourni
//
// Servi en tant que fichier statique par Next (apps/web/public/ → /sw.js),
// donc PAS de bundling, PAS d'import ES module — code plat compatible
// service-worker. Scope = "/" (registré sans option, donc l'URL du SW
// dicte le scope).
// ============================================================

self.addEventListener("install", (event) => {
  // skipWaiting : la nouvelle version du SW prend la main immédiatement
  // sans attendre que tous les onglets ouverts soient fermés. Couplé avec
  // clients.claim() ci-dessous, on garantit qu'au prochain reload le SW
  // déployé est bien celui en cours d'exécution.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // L'API envoie un payload JSON ; en l'absence de payload (cas extrême :
  // push silent ou serveur en panne), on affiche un fallback générique
  // plutôt que de rien afficher — sinon le navigateur Chrome considère
  // que le SW "n'a pas servi l'user" et peut désactiver l'origine.
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
    body:    payload.body || "",
    // icon/badge omis volontairement : le projet n'expose pas de PNG
    // standalone — Next 14 sert le favicon dynamique via icon.tsx
    // (convention App Router). Le navigateur fallback sur ses defaults
    // (Chrome : bell générique, Firefox : icône d'app), ce qui suffit
    // pour la V1. À ajouter quand un PNG 192×192 sera dispo en public/.
    tag:     payload.tag,
    // renotify=true → si une notif avec le même tag existe déjà, elle est
    // remplacée ET on re-buzz l'utilisateur (sinon silent replace).
    renotify: false,
    data:    { url: payload.url || "/" },
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

// WEB-PUSH-V1 sw applied
