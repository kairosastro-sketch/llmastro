// ============================================================
// apps/api/src/routes/admin.ts
// ------------------------------------------------------------
// ARCHIVE-PERSISTENCE-LECTURES-IA-V2
// Routes admin (gardées par bearer token ADMIN_API_TOKEN).
//
// Pour cette V1, seul l'endpoint de régénération de lecture est exposé.
//
// Sécurité :
//  - Bearer token obligatoire dans header Authorization
//  - Si ADMIN_API_TOKEN non configuré ou vide, TOUTES les routes /admin
//    retournent 503 (l'endpoint est désactivé)
// ============================================================

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { regenerateById } from "../services/readings.service.js";
import { xaiService } from "../services/ai.service.js";
import { pool } from "../db/index.js";

// ------------------------------------------------------------
// Hook async preHandler — garde toutes les routes du plugin
// ------------------------------------------------------------
async function requireAdminToken(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const expected = process.env["ADMIN_API_TOKEN"];
  if (!expected || expected.length === 0) {
    reply.code(503).send({
      error: "Service Unavailable",
      message: "Admin API is not configured (ADMIN_API_TOKEN missing)",
    });
    return;
  }

  const auth = req.headers["authorization"];
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) {
    reply.code(401).send({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header",
    });
    return;
  }

  const provided = auth.slice("Bearer ".length).trim();
  if (provided !== expected) {
    reply.code(403).send({
      error: "Forbidden",
      message: "Invalid admin token",
    });
    return;
  }
  // OK, on laisse passer (pas d'appel done() en async — implicite)
}

// ------------------------------------------------------------
// Plugin Fastify
// ------------------------------------------------------------
const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", requireAdminToken);

  // ----------------------------------------------------------
  // GET /admin/status — sanity check pour vérifier que le token marche
  // ----------------------------------------------------------
  fastify.get("/status", async (_req, reply) => {
    return reply.code(200).send({
      ok: true,
      service: "admin",
      version: "ARCHIVE-PERSISTENCE-LECTURES-IA-V2",
    });
  });

  // ----------------------------------------------------------
  // GET /admin/readings/:id — inspecte une lecture
  // ----------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    "/readings/:id",
    async (req, reply) => {
      const { id } = req.params;
      const res = await pool.query(
        `SELECT id, user_id, kind, reading_key, prompt_version, model,
                generated_at, regenerated_at, regen_count
         FROM ai_readings
         WHERE id = $1
         LIMIT 1`,
        [id],
      );
      if (res.rowCount === 0) {
        return reply.code(404).send({ error: "Not Found" });
      }
      return reply.code(200).send({ reading: res.rows[0] });
    },
  );

  // ----------------------------------------------------------
  // POST /admin/readings/regenerate/:id
  // Force la régénération d'une lecture spécifique.
  //
  // NOTE : ce endpoint reconstruit la requête xAI à partir des
  // metadata stockées dans content.meta.messages au moment de la
  // 1ère génération. Pour cette V1, le helper ne stocke PAS ces
  // metadata par défaut (cf. readings.helpers.ts) — donc cet
  // endpoint admin nécessite que les call-sites front aient
  // appelé le helper avec une option `storeMessagesInMeta: true`
  // (à câbler manuellement dans une future itération).
  //
  // En attendant, le mode admin de regen NE PEUT PAS être utilisé
  // pour les lectures n'ayant pas les messages stockés. Il sera
  // disponible naturellement avec l'archive Stripe ou autre où
  // on commencera à stocker l'input dans content.meta.
  // ----------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    "/readings/regenerate/:id",
    async (req, reply) => {
      const { id } = req.params;
      if (!id || typeof id !== "string") {
        return reply.code(400).send({ error: "Bad Request", message: "Missing reading id" });
      }

      const res = await pool.query(
        `SELECT id, kind, content FROM ai_readings WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (res.rowCount === 0) {
        return reply.code(404).send({ error: "Not Found", message: "Reading not found" });
      }
      const row = res.rows[0];
      const content = row.content as any;
      const messages = content?.meta?.messages;
      const options = content?.meta?.options ?? {};

      if (!Array.isArray(messages) || messages.length === 0) {
        return reply.code(409).send({
          error: "Conflict",
          message: "This reading was generated without storing messages metadata. Manual regen via SQL required.",
          hint: "Future versions will support automatic regen via stored meta.messages",
        });
      }

      try {
        if (!xaiService.isConfigured()) {
          return reply.code(503).send({
            error: "Service Unavailable",
            message: "xAI service is not configured (XAI_API_KEY missing)",
          });
        }

        const generator = async () => {
          const raw = await xaiService.chatJSON<any>(messages, options);
          return {
            content: { ...((row.content as any) ?? {}), ...raw },
            model: process.env["XAI_MODEL"] ?? "grok-4-1-fast-non-reasoning",
          };
        };

        const updated = await regenerateById({ readingId: id, generator });
        return reply.code(200).send({
          success: true,
          reading: {
            id: updated.id,
            kind: updated.kind,
            promptVersion: updated.promptVersion,
            regenCount: updated.regenCount,
            regeneratedAt: updated.regeneratedAt,
          },
        });
      } catch (err: any) {
        fastify.log.error({ err }, "[admin] regenerate failed");
        return reply.code(500).send({
          error: "Internal Server Error",
          message: err?.message ?? "Regeneration failed",
        });
      }
    },
  );
};

export default adminRoutes;
