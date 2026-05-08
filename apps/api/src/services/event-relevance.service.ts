// ============================================================
// apps/api/src/services/event-relevance.service.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// Calcule la pertinence personnelle d'un événement cosmique
// (éclipse, lunaison) pour un thème natal donné.
//
// Stratégie :
//   1) Au moment exact de l'événement, on récupère les positions
//      planétaires via @astro-platform/ephemeris.
//   2) On filtre les "transits" pertinents pour ce type d'event :
//      - éclipses + lunaisons : Soleil + Lune (les protagonistes)
//      - (Phase 4) ingressions/stations : la planète concernée
//   3) On calcule les aspects entre ces transits et le natal
//      via `computeTransitAspects` (transits.service) — qui retourne
//      déjà une `priority` numérique (= weight - orb*1.5).
//   4) On garde le top 3 et on multiplie par un facteur d'événement
//      (les éclipses étant intrinsèquement plus marquantes que les
//      lunaisons régulières).
//
// Pure : pas de DB, pas de side effect. Appelé par le dispatcher
// (PR #D) pour décider si une notif doit être créée.
// ============================================================

import { allPositions, jd as toJulianDay } from "@astro-platform/ephemeris";
import {
  computeTransitAspects,
  type PlanetPosition,
} from "./transits.service.js";
import type {
  EclipseEvent,
  LunationEvent,
} from "./sky-events.service.js";
import type { NotificationAspect } from "../types/notification-payload.js";

// ──────────────────────────────────────────────────────────
// Types publics
// ──────────────────────────────────────────────────────────

export interface EventRelevance {
  /** Score numérique d'impact personnel.
   *  Plus haut = plus marquant pour CE natal.
   *  Échelle indicative : 0–25. Seuils par défaut (NOTIFY_THRESHOLD_VALUES) :
   *  low ≥ 6, medium ≥ 10, high ≥ 14. */
  score: number;
  /** Les 3 aspects les plus serrés/forts entre les transits de l'event
   *  et le natal, payload-friendly (pas le full TransitAspect interne). */
  topAspects: NotificationAspect[];
}

// ──────────────────────────────────────────────────────────
// Facteurs de pondération par type d'événement
// ──────────────────────────────────────────────────────────
//
// Idée : à orbe égal, une éclipse a plus de poids qu'une lunaison
// classique, et une nouvelle/pleine lune a plus de poids qu'un quartier.
// Ces facteurs sont volontairement conservateurs au MVP — on les
// ajustera après les premières semaines de production.

const EVENT_WEIGHT_ECLIPSE  = 1.5;
const EVENT_WEIGHT_LUNATION_MAJOR = 1.2; // new / full
const EVENT_WEIGHT_LUNATION_MINOR = 1.0; // first_quarter / last_quarter

function eventWeight(event: LunationEvent | EclipseEvent): number {
  if (event.type === "eclipse") return EVENT_WEIGHT_ECLIPSE;
  // event.type === "lunation"
  return event.phase === "new" || event.phase === "full"
    ? EVENT_WEIGHT_LUNATION_MAJOR
    : EVENT_WEIGHT_LUNATION_MINOR;
}

// ──────────────────────────────────────────────────────────
// Pour les éclipses + lunaisons, le "transit déclencheur"
// est porté par le Soleil + la Lune (la conjonction NL ou
// l'opposition FL). On scorer leurs aspects au natal complet.
// ──────────────────────────────────────────────────────────

const RELEVANT_TRANSIT_PLANETS_FOR_LUMINARIES = ["sun", "moon"] as const;

// ──────────────────────────────────────────────────────────
// Helpers JD ↔ Date (mêmes formules que sky-events.service)
// ──────────────────────────────────────────────────────────

function dateToJD(d: Date): number {
  return toJulianDay(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600,
  );
}

// ──────────────────────────────────────────────────────────
// API publique
// ──────────────────────────────────────────────────────────

/**
 * Score la pertinence personnelle d'un sky-event pour un natal donné.
 *
 * @param event  L'événement (eclipse ou lunation) tel que retourné par
 *               `sky-events.service.computeAllEvents`.
 * @param natal  Les positions planétaires du thème natal de l'user
 *               (Record<planetKey, PlanetPosition>). Doit contenir au
 *               minimum {sun, moon} pour produire un score significatif.
 *
 * @returns      EventRelevance : score (0 si aucun aspect formé) et top 3
 *               aspects sérialisables pour la persistance JSONB.
 */
export function scoreEventForUser(
  event: LunationEvent | EclipseEvent,
  natal: Record<string, PlanetPosition>,
): EventRelevance {
  // Garde-fou : un natal sans positions ne produit aucun score.
  if (!natal || Object.keys(natal).length === 0) {
    return { score: 0, topAspects: [] };
  }

  // 1. Positions planétaires au moment exact de l'event
  const eventDate = new Date(event.date);
  const positions = allPositions(dateToJD(eventDate));

  // 2. Filtrer les transits pertinents pour ce type d'event
  //    (eclipses + lunaisons : Soleil + Lune).
  const relevantTransits: Record<string, PlanetPosition> = {};
  for (const planet of RELEVANT_TRANSIT_PLANETS_FOR_LUMINARIES) {
    const p = positions[planet];
    if (p && typeof p.longitude === "number") {
      relevantTransits[planet] = {
        longitude: p.longitude,
        signIdx:   p.signIdx,
      };
    }
  }

  if (Object.keys(relevantTransits).length === 0) {
    return { score: 0, topAspects: [] };
  }

  // 3. Aspects transit ↔ natal — déjà triés par priority desc
  const aspects = computeTransitAspects(relevantTransits, natal);

  if (aspects.length === 0) {
    return { score: 0, topAspects: [] };
  }

  // 4. Score = priority du top aspect, multiplié par le facteur d'event
  const weight = eventWeight(event);
  const baseScore = aspects[0]!.priority;
  const score = Math.round(baseScore * weight * 100) / 100;

  // 5. Top 3 aspects en payload-friendly format
  const topAspects: NotificationAspect[] = aspects.slice(0, 3).map((a) => ({
    transitPlanet: a.transitPlanet,
    natalPlanet:   a.natalPlanet,
    type:          a.type,
    orb:           a.orb,
  }));

  return { score, topAspects };
}

// ──────────────────────────────────────────────────────────
// Dedup key : identifiant unique stable d'un event par user
// ──────────────────────────────────────────────────────────

/**
 * Construit une clé de déduplication stable pour un event.
 * Le dispatcher (PR #D) l'utilise pour garantir qu'un user ne reçoit
 * jamais 2× la même notif (UNIQUE INDEX en DB).
 *
 * Format : `sky_event:{eventType}:{discriminator}:{YYYY-MM-DD}`
 *
 * Exemples :
 *   - `sky_event:eclipse:solar:2026-09-08`
 *   - `sky_event:lunation:full:2026-05-12`
 *
 * Note 1 : la clé inclut le **type/phase** pour qu'une même date n'écrase
 * pas un événement par un autre (cas théorique d'un éclipse + lunation
 * partageant la même seconde — ne devrait jamais arriver mais safe).
 *
 * Note 2 (DEDUP-KEY-DAY-V1) : on tronque à YYYY-MM-DD plutôt que
 * d'inclure l'ISO complet. La date d'un sky_event est calculée par
 * recherche binaire dans sky-events.service.ts (`(lo + hi) / 2` sur des
 * timestamps ms), qui n'est pas déterministe à la milliseconde près
 * entre deux runs du dispatcher. Sans cette troncature, deux dispatches
 * successifs (toutes les 6h) pour le même événement produisaient deux
 * dedup_keys différents et donc deux notifications dupliquées dans la DB
 * (cf. observation prod du 2026-05-08 : 2 notifs "Dernier quartier" pour
 * le même 2026-05-08). Une phase de lune ou un type d'éclipse ne peut
 * pas se répéter dans la même journée, donc YYYY-MM-DD reste un
 * discriminateur fiable.
 */
export function buildSkyEventDedupKey(
  event: LunationEvent | EclipseEvent,
): string {
  const day = event.date.slice(0, 10); // "2026-05-12T16:56:00.000Z" → "2026-05-12"
  if (event.type === "eclipse") {
    return `sky_event:eclipse:${event.kind}:${day}`;
  }
  // event.type === "lunation"
  return `sky_event:lunation:${event.phase}:${day}`;
}

// NOTIFICATIONS-V1 event-relevance applied
// DEDUP-KEY-DAY-V1 applied
