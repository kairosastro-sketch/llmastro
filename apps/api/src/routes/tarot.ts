// ============================================================
// TAROT-PERSISTENCE-V1 — apps/api/src/routes/tarot.ts
// ------------------------------------------------------------
// Routes pour la sauvegarde / consultation / suppression des
// tirages de tarot.
//
// Miroir comportemental de routes/chat.ts : mêmes endpoints CRUD,
// même tier-gating (par count d'entitlement), même paywall.
// Différence de modèle : un tirage est atomique → une seule table
// `tarot_readings` avec un `data` JSONB (pas de table enfant).
//
// Toutes les routes requièrent l'auth (preHandler middleware).
// Le tier-gating (tarot_save_count) est appliqué au POST.
// ============================================================

import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { db } from "../db/index.js";
import { tarotReadings } from "../db/schema.js";
import { entitlementsService } from "../services/entitlements.service.js";

// ──────────────────────────────────────────────────────────
// Types pour les body / params
// ──────────────────────────────────────────────────────────

interface TarotCardEntry {
  num:      number;
  name:     string;
  position: string;
}

interface TarotReadingData {
  /** Question posée par l'utilisateur (facultative). */
  question?: string;
  /** Cartes tirées, dans l'ordre des positions. */
  cards:     TarotCardEntry[];
  /** Interprétation IA Kairos, si elle a été générée. Stockée in-toto. */
  ai?:       unknown;
}

interface SaveReadingBody {
  title?:          string;
  natalProfileId?: string | null;
  data:            TarotReadingData;
}

interface RenameBody {
  title: string;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/**
 * Récupère la limite de tarot_save_count du user (depuis les entitlements).
 * Retourne -1 si illimité, 0 si feature désactivée, sinon la limite numérique.
 */
async function getTarotSaveLimit(userId: string): Promise<number> {
  const ent = await entitlementsService.getEntitlement(userId, "tarot_save_count");
  if (!ent) return 0;
  const val = ent.value;
  if (typeof val === "number") return val;
  // Fallback défensif si format inattendu
  return 0;
}

/**
 * Compte les tirages sauvegardés du user.
 */
async function countReadings(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tarotReadings)
    .where(eq(tarotReadings.userId, userId));
  return row?.n ?? 0;
}

/**
 * Génère un titre par défaut depuis le contenu du tirage.
 * Priorité : la question posée, sinon les noms des cartes.
 * Tronqué à 60 chars.
 */
function defaultTitle(data: TarotReadingData): string {
  const q = data.question?.trim().replace(/\s+/g, " ");
  if (q) {
    return q.length > 60 ? q.slice(0, 57) + "…" : q;
  }
  const names = (data.cards ?? [])
    .map((c) => c.name)
    .filter((n) => typeof n === "string" && n.trim().length > 0)
    .join(" · ");
  if (names) {
    return names.length > 60 ? names.slice(0, 57) + "…" : names;
  }
  return "Tirage de tarot";
}

// ──────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────

export const tarotRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authMiddleware);

  // --------------------------------------------------------
  // POST /tarot/readings — sauvegarder un tirage
  // --------------------------------------------------------
  fastify.post<{ Body: SaveReadingBody }>(
    "/readings",
    {
      schema: {
        body: {
          type: "object",
          required: ["data"],
          properties: {
            title:          { type: "string", maxLength: 255 },
            natalProfileId: { type: ["string", "null"] },
            data: {
              type: "object",
              required: ["cards"],
              properties: {
                question: { type: "string", maxLength: 200 },
                cards: {
                  type: "array",
                  minItems: 1,
                  maxItems: 12,
                  items: {
                    type: "object",
                    required: ["num", "name", "position"],
                    properties: {
                      num:      { type: "number" },
                      name:     { type: "string", minLength: 1 },
                      position: { type: "string", minLength: 1 },
                    },
                    additionalProperties: true,
                  },
                },
                // Interprétation IA optionnelle — stockée telle quelle.
                ai: { type: ["object", "null"] },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const { title, natalProfileId, data } = req.body;

      // ── Tier check : limite de tirages sauvegardables ──
      const limit = await getTarotSaveLimit(userId);

      // 0 = feature désactivée pour ce tier
      if (limit === 0) {
        return reply.code(403).send({
          success: false,
          error: {
            code:    "TIER_FEATURE_DISABLED",
            message: "Tarot save not available on your plan",
            details: { feature: "tarot_save_count" },
          },
        });
      }

      // -1 = illimité, sinon on compare au count actuel
      if (limit !== -1) {
        const current = await countReadings(userId);
        if (current >= limit) {
          return reply.code(403).send({
            success: false,
            error: {
              code:    "TIER_LIMIT_REACHED",
              message: `Tarot save limit reached (${current}/${limit}). Upgrade your plan to save more readings.`,
              details: { feature: "tarot_save_count", current, limit },
            },
          });
        }
      }

      // ── Insert ──
      const computedTitle = (title && title.trim().length > 0)
        ? title.trim().slice(0, 255)
        : defaultTitle(data);

      const [created] = await db
        .insert(tarotReadings)
        .values({
          userId,
          natalProfileId: natalProfileId ?? null,
          title:          computedTitle,
          data:           data as object,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to insert tarot reading");
      }

      return reply.code(201).send({
        success: true,
        data: {
          reading: {
            id:             created.id,
            title:          created.title,
            natalProfileId: created.natalProfileId,
            createdAt:      created.createdAt,
          },
        },
      });
    },
  );

  // --------------------------------------------------------
  // GET /tarot/readings — liste
  // --------------------------------------------------------
  fastify.get("/readings", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;

    const rows = await db
      .select({
        id:             tarotReadings.id,
        title:          tarotReadings.title,
        natalProfileId: tarotReadings.natalProfileId,
        createdAt:      tarotReadings.createdAt,
      })
      .from(tarotReadings)
      .where(eq(tarotReadings.userId, userId))
      .orderBy(desc(tarotReadings.createdAt));

    return reply.send({
      success: true,
      data: { readings: rows },
    });
  });

  // --------------------------------------------------------
  // GET /tarot/readings/quota — info pour l'UI
  // --------------------------------------------------------
  // Permet au frontend de savoir avant de saver si l'user va se prendre
  // un 403, pour afficher un état "quota atteint" plutôt que tenter et fail.
  fastify.get("/readings/quota", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;

    const limit = await getTarotSaveLimit(userId);
    const current = await countReadings(userId);

    return reply.send({
      success: true,
      data: {
        limit,                                  // -1 = illimité, 0 = désactivé
        current,
        canSave: limit === -1 || (limit > 0 && current < limit),
      },
    });
  });

  // --------------------------------------------------------
  // GET /tarot/readings/:id — détails + data complet
  // --------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    "/readings/:id",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const { id } = req.params;

      const [reading] = await db
        .select()
        .from(tarotReadings)
        .where(
          and(
            eq(tarotReadings.id, id),
            eq(tarotReadings.userId, userId),
          ),
        )
        .limit(1);

      if (!reading) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tarot reading not found" },
        });
      }

      return reply.send({
        success: true,
        data: {
          reading: {
            id:             reading.id,
            title:          reading.title,
            natalProfileId: reading.natalProfileId,
            createdAt:      reading.createdAt,
            data:           reading.data,
          },
        },
      });
    },
  );

  // --------------------------------------------------------
  // PATCH /tarot/readings/:id — renommer
  // --------------------------------------------------------
  fastify.patch<{ Params: { id: string }; Body: RenameBody }>(
    "/readings/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 255 },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const { id } = req.params;
      const { title } = req.body;

      const [updated] = await db
        .update(tarotReadings)
        .set({ title: title.trim().slice(0, 255) })
        .where(
          and(
            eq(tarotReadings.id, id),
            eq(tarotReadings.userId, userId),
          ),
        )
        .returning();

      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tarot reading not found" },
        });
      }

      return reply.send({
        success: true,
        data: {
          reading: {
            id:             updated.id,
            title:          updated.title,
            natalProfileId: updated.natalProfileId,
            createdAt:      updated.createdAt,
          },
        },
      });
    },
  );

  // --------------------------------------------------------
  // DELETE /tarot/readings/:id
  // --------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    "/readings/:id",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const { id } = req.params;

      const [deleted] = await db
        .delete(tarotReadings)
        .where(
          and(
            eq(tarotReadings.id, id),
            eq(tarotReadings.userId, userId),
          ),
        )
        .returning({ id: tarotReadings.id });

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Tarot reading not found" },
        });
      }

      return reply.send({
        success: true,
        data: { id: deleted.id },
      });
    },
  );
};

// TAROT-PERSISTENCE-V1 applied
