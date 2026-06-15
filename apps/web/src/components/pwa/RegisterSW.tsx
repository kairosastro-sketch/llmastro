"use client";

// PWA-OFFLINE-V1
// Enregistre le Service Worker (/sw.js) pour TOUS les visiteurs, pas seulement
// ceux qui activent les notifications push (cf. hooks/usePushSubscription.ts).
// navigator.serviceWorker.register est idempotent pour une même URL+scope :
// si le hook push l'a déjà enregistré, on récupère le même registration.
//
// But : permettre l'installabilité PWA + le cache offline dès la 1re visite.
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // On attend l'event `load` pour ne pas concurrencer le chargement initial
    // des ressources critiques de la page.
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Pas bloquant : l'app fonctionne sans SW (juste sans offline/install).
        console.warn("[PWA] Service Worker registration failed:", err);
      });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}

// PWA-OFFLINE-V1 applied
