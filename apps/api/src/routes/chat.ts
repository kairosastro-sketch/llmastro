// ============================================================
// CHAT-PERSISTENCE-V1-DATA — apps/api/src/routes/chat.ts
// ------------------------------------------------------------
// Routes pour la sauvegarde / consultation / suppression
// des conversations chat Kairos.
//
// Toutes les routes requièrent l'auth (preHandler middleware).
// Le tier-gating (chat_save_count) est appliqué au POST.
// ============================================================

import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { db } from "../db/index.js";
import {
  chatConversations,
  chatMessages,
} from "../db/schema.js";
import { entitlementsService } from "../services/entitlements.service.js";

// ──────────────────────────────────────────────────────────
// Types pour les body / params
// ──────────────────────────────────────────────────────────

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface SaveConversationBody {
  planetKey: string;
  title?: string;
  natalProfileId?: string | null;
  messages: IncomingMessage[];
}

interface RenameBody {
  title: string;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/**
 * Récupère la limite de chat_save_count du user (depuis les entitlements).
 * Retourne -1 si illimité, 0 si feature désactivée, sinon la limite numérique.
 */
async function getChatSaveLimit(userId: string): Promise<number> {
  const ent = await entitlementsService.getEntitlement(userId, "chat_save_count");
  if (!ent) return 0;
  const val = ent.value;
  if (typeof val === "number") return val;
  // Fallback défensif si jamais format inattendu
  return 0;
}

/**
 * Compte les conversations existantes du user.
 */
async function countConversations(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatConversations)
    .where(eq(chatConversations.userId, userId));
  return row?.n ?? 0;
}

/**
 * Génère un titre par défaut depuis les premiers messages.
 * Tronque à 60 chars. Fallback sur la planète si rien d'utilisable.
 */
function defaultTitle(messages: IncomingMessage[], planetKey: string): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim().length > 0);
  if (firstUser) {
    const trimmed = firstUser.content.trim().replace(/\s+/g, " ");
    return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
  }
  return `Conversation ${planetKey}`;
}

// ──────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authMiddleware);

  // --------------------------------------------------------
  // POST /chat/conversations — sauvegarder
  // --------------------------------------------------------
  fastify.post<{ Body: SaveConversationBody }>(
    "/conversations",
    {
      schema: {
        body: {
          type: "object",
          required: ["planetKey", "messages"],
          properties: {
            planetKey:      { type: "string", minLength: 1, maxLength: 20 },
            title:          { type: "string", maxLength: 255 },
            natalProfileId: { type: ["string", "null"] },
            messages: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["role", "content"],
                properties: {
                  role:    { type: "string", enum: ["user", "assistant"] },
                  content: { type: "string", minLength: 1 },
                },
                additionalProperties: true,
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const { planetKey, title, natalProfileId, messages } = req.body;

      // ── Tier check : limite de conversations sauvegardables ──
      const limit = await getChatSaveLimit(userId);

      // 0 = feature désactivée pour ce tier (ne devrait pas arriver pour V1)
      if (limit === 0) {
        return reply.code(403).send({
          success: false,
          error: {
            code:    "TIER_FEATURE_DISABLED",
            message: "Chat save not available on your plan",
            details: { feature: "chat_save_count" },
          },
        });
      }

      // -1 = illimité, sinon on compare au count actuel
      if (limit !== -1) {
        const current = await countConversations(userId);
        if (current >= limit) {
          return reply.code(403).send({
            success: false,
            error: {
              code:    "TIER_LIMIT_REACHED",
              message: `Chat save limit reached (${current}/${limit}). Upgrade your plan to save more conversations.`,
              details: { feature: "chat_save_count", current, limit },
            },
          });
        }
      }

      // ── Insert conversation + messages dans une transaction ──
      const computedTitle = (title && title.trim().length > 0)
        ? title.trim().slice(0, 255)
        : defaultTitle(messages, planetKey);

      const created = await db.transaction(async (tx) => {
        const [conv] = await tx
          .insert(chatConversations)
          .values({
            userId,
            natalProfileId: natalProfileId ?? null,
            planetKey,
            title: computedTitle,
          })
          .returning();

        if (!conv) {
          throw new Error("Failed to insert conversation");
        }

        const messagesValues = messages.map((m) => ({
          conversationId: conv.id,
          role:           m.role,
          content:        m.content,
        }));

        await tx.insert(chatMessages).values(messagesValues);

        // Mettre à jour last_message_at au timestamp du dernier message
        // (pour l'instant = now(), donc déjà à jour)

        return conv;
      });

      return reply.code(201).send({
        success: true,
        data: {
          conversation: {
            id:             created.id,
            planetKey:      created.planetKey,
            title:          created.title,
            natalProfileId: created.natalProfileId,
            createdAt:      created.createdAt,
            lastMessageAt:  created.lastMessageAt,
            messagesCount:  messages.length,
          },
        },
      });
    },
  );

  // --------------------------------------------------------
  // GET /chat/conversations — liste
  // --------------------------------------------------------
  fastify.get("/conversations", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;

    const rows = await db
      .select({
        id:             chatConversations.id,
        planetKey:      chatConversations.planetKey,
        title:          chatConversations.title,
        natalProfileId: chatConversations.natalProfileId,
        createdAt:      chatConversations.createdAt,
        lastMessageAt:  chatConversations.lastMessageAt,
      })
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.lastMessageAt));

    return reply.send({
      success: true,
      data: { conversations: rows },
    });
  });

  // --------------------------------------------------------
  // GET /chat/conversations/:id — détails + messages
  // --------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    "/conversations/:id",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const { id } = req.params;

      const [conv] = await db
        .select()
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.id, id),
            eq(chatConversations.userId, userId),
          ),
        )
        .limit(1);

      if (!conv) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Conversation not found" },
        });
      }

      const messagesList = await db
        .select({
          id:        chatMessages.id,
          role:      chatMessages.role,
          content:   chatMessages.content,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, id))
        .orderBy(asc(chatMessages.createdAt));

      return reply.send({
        success: true,
        data: {
          conversation: {
            id:             conv.id,
            planetKey:      conv.planetKey,
            title:          conv.title,
            natalProfileId: conv.natalProfileId,
            createdAt:      conv.createdAt,
            lastMessageAt:  conv.lastMessageAt,
            messages:       messagesList,
          },
        },
      });
    },
  );

  // --------------------------------------------------------
  // PATCH /chat/conversations/:id — renommer
  // --------------------------------------------------------
  fastify.patch<{ Params: { id: string }; Body: RenameBody }>(
    "/conversations/:id",
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
        .update(chatConversations)
        .set({ title: title.trim().slice(0, 255) })
        .where(
          and(
            eq(chatConversations.id, id),
            eq(chatConversations.userId, userId),
          ),
        )
        .returning();

      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Conversation not found" },
        });
      }

      return reply.send({
        success: true,
        data: {
          conversation: {
            id:             updated.id,
            planetKey:      updated.planetKey,
            title:          updated.title,
            natalProfileId: updated.natalProfileId,
            createdAt:      updated.createdAt,
            lastMessageAt:  updated.lastMessageAt,
          },
        },
      });
    },
  );

  // --------------------------------------------------------
  // DELETE /chat/conversations/:id
  // --------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    "/conversations/:id",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const { id } = req.params;

      const [deleted] = await db
        .delete(chatConversations)
        .where(
          and(
            eq(chatConversations.id, id),
            eq(chatConversations.userId, userId),
          ),
        )
        .returning({ id: chatConversations.id });

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Conversation not found" },
        });
      }

      return reply.send({
        success: true,
        data: { id: deleted.id },
      });
    },
  );

  // --------------------------------------------------------
  // GET /chat/conversations/quota — info pour l'UI
  // --------------------------------------------------------
  // Permet au frontend de savoir avant de saver si l'user va se prendre
  // un 403, pour afficher un état "quota atteint" plutôt que tenter et fail.
  fastify.get("/conversations/quota", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;

    const limit = await getChatSaveLimit(userId);
    const current = await countConversations(userId);

    return reply.send({
      success: true,
      data: {
        limit,                                  // -1 = illimité, 0 = désactivé
        current,
        canSave: limit === -1 || (limit > 0 && current < limit),
      },
    });
  });
};

// CHAT-PERSISTENCE-V1-DATA applied
