import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { natalData, type NatalData } from "../db/schema.js";
import { growthService } from "./growth.service.js";

export type NatalDataCreate = {
  label:            string;
  birthDate:        string;
  birthTime:        string;
  birthTimeUnknown: boolean;
  latitude:         number;
  longitude:        number;
  timezone:         string;
  birthCity:        string;
  birthCountry:     string;
  gender?:             "male" | "female" | "unspecified";
  relationshipStatus?: "single" | "couple" | "unspecified";
};

export class NatalService {

  async findByUser(userId: string): Promise<NatalData[]> {
    // Ordre DÉTERMINISTE : sans ORDER BY, Postgres renvoyait les profils dans
    // l'ordre physique du heap, qui change après un UPDATE → le profil "moi"
    // pouvait passer derrière un autre, et le chat (profiles[0]) se mettait à
    // parler au mauvais profil. On force : profil "moi" (is_self) d'abord, puis
    // le plus ancien (created_at) — le profil principal revient toujours en tête.
    return db
      .select()
      .from(natalData)
      .where(eq(natalData.userId, userId))
      .orderBy(desc(natalData.isSelf), asc(natalData.createdAt));
  }

  async findOne(id: string, userId: string): Promise<NatalData | null> {
    const [record] = await db
      .select()
      .from(natalData)
      .where(and(eq(natalData.id, id), eq(natalData.userId, userId)))
      .limit(1);
    return record ?? null;
  }

  async create(userId: string, data: NatalDataCreate): Promise<NatalData> {
    const [record] = await db
      .insert(natalData)
      .values({ ...data, userId })
      .returning();

    // [GROWTH-V1-ACTIVATION-HOOK] Tentative d'activation parrainage.
    // Fire-and-forget : la création de natal NE DOIT JAMAIS échouer
    // à cause d'un problème côté growth. Le service est idempotent —
    // si déjà rewarded ou compte trop jeune, no-op silencieux.
    void growthService.tryActivateReferral(userId).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn("[growth] tryActivateReferral failed (non-blocking)", {
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
    });

    return record!;
  }

  async update(id: string, userId: string, data: Partial<NatalDataCreate>): Promise<NatalData | null> {
    const existing = await this.findOne(id, userId);
    if (!existing) return null;
    const [updated] = await db
      .update(natalData)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(natalData.id, id), eq(natalData.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, userId: string): Promise<void> {
    await db
      .delete(natalData)
      .where(and(eq(natalData.id, id), eq(natalData.userId, userId)));
  }
}

export const natalService = new NatalService();
