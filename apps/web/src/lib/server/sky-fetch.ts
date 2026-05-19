// ============================================================
// apps/web/src/lib/server/sky-fetch.ts
// CIEL-PUBLIC-V1-PAGES
// ------------------------------------------------------------
// Helper SSR pour fetcher /public/sky/:cadence côté server component.
// En production Docker, on appelle directement http://api:4000 (réseau
// interne), bien plus rapide que de repasser via Caddy/HTTPS externe.
// ============================================================

export type Cadence = "day" | "week" | "month" | "year";

export const CADENCE_TO_SLUG: Record<Cadence, string> = {
  day:   "aujourd-hui",
  week:  "semaine",
  month: "mois",
  year:  "annee",
};

export const SLUG_TO_CADENCE: Record<string, Cadence> = {
  "aujourd-hui": "day",
  "semaine":     "week",
  "mois":        "month",
  "annee":       "year",
};

export const ALL_SLUGS: ReadonlyArray<keyof typeof SLUG_TO_CADENCE> = [
  "aujourd-hui",
  "semaine",
  "mois",
  "annee",
];

// ──────────────────────────────────────────────────────────
// Types du payload — alignés sur ce que retourne l'API
// ──────────────────────────────────────────────────────────

export interface PlanetData {
  longitude: number;
  retrograde?: boolean;
}

export interface MoonPhase {
  phase?:        string;
  emoji?:        string;
  description?:  string;
  illumination?: number;
  key?:          string;
}

export interface TransitAspect {
  transitPlanet: string;
  natalPlanet:   string;
  type:          string;
  typeFr:        string;
  symbol:        string;
  angle:         number;
  orb:           number;
  exact:         boolean;
  tight:         boolean;
  tone:          "harmony" | "tension" | "neutral";
  priority:      number;
}

export interface IngressEvent {
  type:     "ingress";
  date:     string;
  planet:   string;
  fromSign: number;
  toSign:   number;
}

export interface StationEvent {
  type:      "station";
  date:      string;
  planet:    string;
  direction: "retrograde" | "direct";
}

// LunationEvent / EclipseEvent partagés api↔web via packages/types
// (cf. notifications.data.event qui réutilise la même shape).
export type { LunationEvent, EclipseEvent } from "@astro-platform/types";

import type { LunationEvent, EclipseEvent } from "@astro-platform/types";

export interface SkyEvents {
  ingresses: IngressEvent[];
  stations:  StationEvent[];
  lunations: LunationEvent[];
  eclipses:  EclipseEvent[];
}

export interface SkyData {
  referenceDate: string;
  planets:       Record<string, PlanetData>;
  asc:           number;
  mc:            number;
  moonPhase:     MoonPhase | null;
  aspects:       TransitAspect[];
  events?:       SkyEvents;  // optional for backwards compat (V1 POSITIONS)
}

export interface SkyPublicationResponse {
  cadence:                Cadence;
  periodStart:            string;
  periodEnd:              string;
  data:                   SkyData;
  llmText:                string | null;
  llmGeneratedAt:         string | null;
  // CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2 — Lecture technique
  llmTextAdvanced:        string | null;
  llmAdvancedGeneratedAt: string | null;
}

// ──────────────────────────────────────────────────────────
// Fetch
// ──────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  // SSR : utilise le réseau Docker interne si dispo, sinon fallback public
  if (typeof window === "undefined") {
    return (
      process.env["INTERNAL_API_URL"] ||
      process.env["NEXT_PUBLIC_API_URL"] ||
      "http://localhost:4000"
    );
  }
  // CSR : utilise toujours l'URL publique
  return process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:4000";
}

// CIEL-ISR-REVALIDATE-V1 — délai de revalidation de secours par cadence.
// Le mécanisme principal est la revalidation à la demande : le backend
// (boot/init-sky) POST vers /revalidate-sky qui appelle `revalidateTag`
// sur `sky-<cadence>` dès qu'une publication change. Ces délais ne sont
// qu'un filet de sécurité si un ping est manqué (web redémarré, etc.).
const SKY_REVALIDATE_FALLBACK: Record<Cadence, number> = {
  day:   3600,    // 1 h
  week:  21600,   // 6 h
  month: 86400,   // 24 h
  year:  86400,   // 24 h
};

/**
 * Cache tag d'une cadence — `revalidateTag` côté /revalidate-sky cible
 * ce tag, ce qui invalide d'un coup la page FR et la page EN.
 */
export function skyCacheTag(cadence: Cadence): string {
  return `sky-${cadence}`;
}

/**
 * Fetch the sky publication for a cadence. Used in Server Components.
 * Returns null on error (rendered as a "sky unavailable" page).
 *
 * Le fetch est taggé `sky-<cadence>` pour pouvoir être invalidé à la
 * demande via `revalidateTag`, avec un fallback temporel par cadence.
 */
export async function fetchSky(cadence: Cadence): Promise<SkyPublicationResponse | null> {
  const url = `${getApiBaseUrl()}/public/sky/${cadence}`;
  try {
    const res = await fetch(url, {
      next: {
        revalidate: SKY_REVALIDATE_FALLBACK[cadence],
        tags: [skyCacheTag(cadence)],
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.success !== true || !json.data) return null;
    return json.data as SkyPublicationResponse;
  } catch {
    return null;
  }
}

// CIEL-PUBLIC-V1-PAGES sky-fetch applied

// CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2 sky-fetch applied

// CIEL-ISR-REVALIDATE-V1 sky-fetch applied
