// COMMUNITY-V1 — service des stats sociales anonymes (cf. COMMUNITY-V1.md).
//
// Principes :
//   - Projection : on dérive du thème "moi" (natal_data.is_self) les placements
//     big three (Soleil, Lune, Ascendant si heure connue, C-22) dans la table
//     community_placements. Aucune donnée de naissance ré-identifiante (C-06).
//   - Lecture : agrégats GROUP BY soumis à k-anonymité K_MIN (C-03). Un bucket
//     sous le seuil n'expose ni count ni part (C-04/C-14).
import { and, eq } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import {
  users,
  natalData,
  communityPlacements,
  type NewCommunityPlacementRow,
} from "../db/schema.js";
import { natalService } from "./natal.service.js";
import { ephemerisService, type EnrichedChart } from "@astro-platform/ephemeris";
import {
  signName,
  signElement,
  signModality,
  longitudeToSignIdx,
  longitudeToSignDegree,
} from "../lib/zodiac.js";

// Seuil de k-anonymité (C-03). Configurable, défaut 20 (O-01).
const K_MIN = (() => {
  const n = parseInt(process.env["COMMUNITY_K_MIN"] ?? "20", 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
})();

type Dimension = "sun" | "moon" | "ascendant";
const DIMENSION_TO_PLANET: Record<Dimension, string> = {
  sun: "Sun",
  moon: "Moon",
  ascendant: "Ascendant",
};

type ProjectedPlacement = {
  planet: string;
  signIdx: number;
  degree: number;
  house: number | null;
};

// Extrait les placements big three d'un thème calculé (C-22).
function bigThreeFromChart(chart: EnrichedChart): ProjectedPlacement[] {
  const out: ProjectedPlacement[] = [];
  const sun = chart.planets?.["sun"];
  const moon = chart.planets?.["moon"];
  if (sun) {
    out.push({ planet: "Sun", signIdx: sun.signIdx, degree: Math.floor(sun.degree ?? 0), house: sun.house ?? null });
  }
  if (moon) {
    out.push({ planet: "Moon", signIdx: moon.signIdx, degree: Math.floor(moon.degree ?? 0), house: moon.house ?? null });
  }
  // L'Ascendant n'est projeté que si l'heure de naissance est connue (C-22).
  if (chart.meta?.birthTimeKnown && typeof chart.asc === "number") {
    out.push({
      planet: "Ascendant",
      signIdx: longitudeToSignIdx(chart.asc),
      degree: longitudeToSignDegree(chart.asc),
      house: null, // l'Ascendant est un angle, pas une maison
    });
  }
  return out;
}

export class CommunityService {
  /** Seuil de k-anonymité effectif (exposé pour les réponses). */
  get kMin(): number {
    return K_MIN;
  }

  /**
   * Désigne le thème "moi" du membre (C-07). Un seul is_self=true par user.
   * Retourne false si le profil n'appartient pas au user.
   */
  async setSelfProfile(userId: string, natalId: string): Promise<boolean> {
    const owned = await natalService.findOne(natalId, userId);
    if (!owned) return false;
    await db.transaction(async (tx) => {
      await tx
        .update(natalData)
        .set({ isSelf: false })
        .where(and(eq(natalData.userId, userId), eq(natalData.isSelf, true)));
      await tx
        .update(natalData)
        .set({ isSelf: true })
        .where(and(eq(natalData.id, natalId), eq(natalData.userId, userId)));
    });
    return true;
  }

  /**
   * (Re)projette le thème "moi" du membre dans community_placements.
   * Sans profil "moi", purge la contribution du membre.
   */
  async projectSelfChart(userId: string): Promise<void> {
    const [self] = await db
      .select()
      .from(natalData)
      .where(and(eq(natalData.userId, userId), eq(natalData.isSelf, true)))
      .limit(1);

    if (!self) {
      await db.delete(communityPlacements).where(eq(communityPlacements.userId, userId));
      return;
    }

    const chart = await ephemerisService.calculateNatalChart({
      natalId: self.id,
      localBirthDate: self.birthDate,
      localBirthTime: self.birthTime ?? "12:00",
      ianaTz: self.timezone,
      latitude: self.latitude,
      longitude: self.longitude,
      birthTimeKnown: !(self.birthTimeUnknown ?? false),
    });

    const rows: NewCommunityPlacementRow[] = bigThreeFromChart(chart).map((p) => ({
      userId,
      planet: p.planet,
      sign: signName(p.signIdx),
      signDegree: p.degree,
      house: p.house,
      element: signElement(p.signIdx),
      modality: signModality(p.signIdx),
    }));

    await db.transaction(async (tx) => {
      await tx.delete(communityPlacements).where(eq(communityPlacements.userId, userId));
      if (rows.length > 0) await tx.insert(communityPlacements).values(rows);
    });
  }

  /**
   * Active l'opt-in : désigne le profil "moi", grave le consentement (C-16),
   * projette le thème. Retourne null si le profil n'appartient pas au user.
   */
  async optIn(userId: string, natalId: string) {
    const ok = await this.setSelfProfile(userId, natalId);
    if (!ok) return null;
    await db
      .update(users)
      .set({ communityStatsOptIn: true, communityOptInAt: new Date() })
      .where(eq(users.id, userId));
    await this.projectSelfChart(userId);
    return this.getMyPlacementStats(userId);
  }

  /** Retire l'opt-in et efface immédiatement la contribution du membre (C-05). */
  async optOut(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ communityStatsOptIn: false, communityOptInAt: null })
      .where(eq(users.id, userId));
    await db.delete(communityPlacements).where(eq(communityPlacements.userId, userId));
  }

  /**
   * Stats du membre : pour chacun de ses placements big three, sa part dans la
   * population. Un bucket sous K_MIN est masqué (count/total/share = null).
   */
  async getMyPlacementStats(userId: string) {
    const [u] = await db
      .select({ optIn: users.communityStatsOptIn })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!u?.optIn) {
      return { optedIn: false as const, kMin: K_MIN };
    }

    const mine = await db
      .select({ planet: communityPlacements.planet, sign: communityPlacements.sign })
      .from(communityPlacements)
      .where(eq(communityPlacements.userId, userId));

    if (mine.length === 0) {
      // Opt-in actif mais projection pas encore faite (cas limite).
      return { optedIn: true as const, kMin: K_MIN, needsProjection: true, placements: [] };
    }

    const planets = mine.map((m) => m.planet);
    const bucketsRes = await pool.query(
      `SELECT planet, sign, count(*)::int AS c
         FROM community_placements
        WHERE planet = ANY($1)
        GROUP BY planet, sign`,
      [planets],
    );
    const totalsRes = await pool.query(
      `SELECT planet, count(*)::int AS c
         FROM community_placements
        WHERE planet = ANY($1)
        GROUP BY planet`,
      [planets],
    );

    const bucketMap = new Map<string, number>();
    for (const r of bucketsRes.rows) bucketMap.set(`${r.planet}|${r.sign}`, r.c);
    const totalMap = new Map<string, number>();
    for (const r of totalsRes.rows) totalMap.set(r.planet, r.c);

    const placements = mine.map((m) => {
      const bucket = bucketMap.get(`${m.planet}|${m.sign}`) ?? 0;
      const total = totalMap.get(m.planet) ?? 0;
      const kOk = bucket >= K_MIN;
      return {
        planet: m.planet,
        sign: m.sign,
        kOk,
        count: kOk ? bucket : null,
        total: kOk ? total : null,
        sharePct: kOk && total > 0 ? Math.round((bucket / total) * 100) : null,
      };
    });

    return { optedIn: true as const, kMin: K_MIN, placements };
  }

  /**
   * Distribution d'une dimension sur les 12 signes. Seuls les buckets ≥ K_MIN
   * sont exposés (C-04). Le total est masqué si un unique bucket est caché,
   * pour qu'on ne puisse pas l'inférer par soustraction (C-14).
   */
  async getDistribution(dimension: Dimension) {
    const planet = DIMENSION_TO_PLANET[dimension];
    const res = await pool.query(
      `SELECT sign, count(*)::int AS c
         FROM community_placements
        WHERE planet = $1
        GROUP BY sign`,
      [planet],
    );

    const total = res.rows.reduce((s: number, r: { c: number }) => s + r.c, 0);
    const shown = res.rows.filter((r: { c: number }) => r.c >= K_MIN);
    const hiddenSigns = res.rows.length - shown.length;

    const buckets = shown
      .map((r: { sign: string; c: number }) => ({
        sign: r.sign,
        count: r.c,
        sharePct: total > 0 ? Math.round((r.c / total) * 100) : 0,
      }))
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count);

    return {
      dimension,
      planet,
      kMin: K_MIN,
      total: hiddenSigns === 1 ? null : total,
      hiddenSigns,
      buckets,
    };
  }
}

export const communityService = new CommunityService();
