// PWA-MANIFEST-V1
// Web App Manifest généré par Next App Router (servi sur /manifest.webmanifest).
// Couleurs alignées sur le thème « Céleste » dark : bg #14102e, ✦ doré #e6cb8e.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Llmastro — Astrologie & IA",
    short_name: "Llmastro",
    description:
      "Thème natal, horoscopes personnalisés, synastrie et tarot. Positions calculées côté serveur (Swiss Ephemeris).",
    lang: "fr",
    dir: "ltr",
    // Une fois installée, l'app ouvre directement sur le dashboard.
    // ?source=pwa pour distinguer le trafic app installée dans l'analytics.
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14102e",
    theme_color: "#14102e",
    categories: ["lifestyle", "entertainment"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable = icônes adaptatives Android (safe-zone), évite le rognage.
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

// PWA-MANIFEST-V1 applied
