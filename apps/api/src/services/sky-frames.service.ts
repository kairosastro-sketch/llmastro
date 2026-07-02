// ============================================================
// apps/api/src/services/sky-frames.service.ts
// CIEL-SKY3D-V1
// ------------------------------------------------------------
// Calcule une suite de "frames" de positions planétaires sur la
// période courante d'une cadence (jour/semaine/mois/an), pour
// alimenter le sweep animé de la roue 3D côté /ciel.
//
// On NE laisse PAS le client deviner les éphémérides : chaque frame
// est calculée serveur via allPositions(jd(...)) — même moteur que
// le snapshot (routé swiss/astra). Le résultat est mémoïsé par
// période (positions stables tant que la période ne change pas).
// ============================================================

import { allPositions, jd } from "@astro-platform/ephemeris";
import { getPeriodBounds, type Cadence } from "./sky-publication.service.js";

// Les 10 corps classiques — alignés sur la roue 2D (EphemerisWheel).
const MAJORS = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
] as const;

// CIEL-SKY3D-MINORS-V1 : astres mineurs proposés en option (case à cocher
// côté roue 3D). Chiron + les 4 astéroïdes féminins + Lilith MOYENNE
// (SE_MEAN_APOG) — la Lilith vraie/osculatrice oscille trop pour un sweep
// interpolé. Chiron + astéroïdes exigent les fichiers .se1 (moteur swiss) ;
// s'ils sont absents (moteur astracore), allPositions ne les renvoie pas et
// `minors` ressort vide → le front masque la case automatiquement.
// SKY3D-NODES-V1 : + nœuds lunaires. `northNode` vient du moteur (nœud moyen
// côté astracore — lent et régulier, interpole bien) ; `southNode` est dérivé
// (+180°) dans la boucle de frames, le moteur ne le renvoie pas.
const MINORS = [
  "chiron", "ceres", "pallas", "juno", "vesta", "lilith",
  "northNode", "southNode",
] as const;

// Densité d'échantillonnage + corps balayés, par cadence.
// `dropMoon` sur l'année : la Lune (~13°/j) reviendrait ~13 fois,
// impossible à interpoler proprement à cette échelle → on l'exclut
// du sweep annuel (qui parle surtout des planètes lentes / ingrès).
const SWEEP: Record<Cadence, { frames: number; dropMoon?: boolean }> = {
  day:   { frames: 24 },
  week:  { frames: 56 },
  month: { frames: 60 },
  year:  { frames: 120, dropMoon: true },
};

export interface SkyFrame {
  /** ISO 8601 de l'instant de la frame */
  t: string;
  /** longitude écliptique (0-360) par corps */
  lon: Record<string, number>;
}

export interface SkyFramesPayload {
  cadence: Cadence;
  periodStart: string;
  periodEnd: string;
  bodies: string[];
  /** CIEL-SKY3D-MINORS-V1 : sous-ensemble de `bodies` à afficher en option. */
  minors: string[];
  frames: SkyFrame[];
}

/** Julian Day (UT) depuis une Date — jd() attend le mois en 1-12. */
function jdFromDate(d: Date): number {
  return jd(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600,
  );
}

// Mémo par période — clé `cadence:periodStart`. Borné pour ne pas fuir.
const cache = new Map<string, SkyFramesPayload>();

export function computeSkyFrames(cadence: Cadence, ref: Date = new Date()): SkyFramesPayload {
  const { start, end } = getPeriodBounds(cadence, ref);
  const key = `${cadence}:${start.toISOString()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const cfg = SWEEP[cadence];
  const majors = cfg.dropMoon ? MAJORS.filter((b) => b !== "moon") : [...MAJORS];
  // Corps candidats : majeurs (toujours) + mineurs (si le moteur les calcule).
  const candidate = [...majors, ...MINORS];
  const n = cfg.frames;
  const startMs = start.getTime();
  const span = end.getTime() - startMs;

  const frames: SkyFrame[] = [];
  for (let i = 0; i <= n; i++) {
    const d = new Date(startMs + (span * i) / n);
    const pos = allPositions(jdFromDate(d));
    const lon: Record<string, number> = {};
    for (const b of candidate) {
      const p = pos[b];
      if (p) lon[b] = p.longitude;
    }
    // SKY3D-NODES-V1 : nœud sud = nœud nord + 180° (non fourni par le moteur)
    if (lon["northNode"] !== undefined && lon["southNode"] === undefined) {
      lon["southNode"] = (lon["northNode"] + 180) % 360;
    }
    frames.push({ t: d.toISOString(), lon });
  }

  // Ne déclare que les corps réellement présents (la 1re frame fait foi —
  // mêmes corps d'une frame à l'autre, le moteur ne varie pas en cours de
  // période). Si les .se1 manquent, les mineurs sont simplement absents.
  const first = frames[0]?.lon ?? {};
  const present = (list: readonly string[]) => list.filter((b) => first[b] !== undefined);

  const payload: SkyFramesPayload = {
    cadence,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    bodies: present(candidate),
    minors: present(MINORS),
    frames,
  };

  cache.set(key, payload);
  if (cache.size > 16) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return payload;
}

// CIEL-SKY3D-V1 sky-frames.service applied
// CIEL-SKY3D-MINORS-V1 applied
// SKY3D-NODES-V1 applied
