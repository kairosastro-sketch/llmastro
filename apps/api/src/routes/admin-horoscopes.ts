// ============================================================
// GENERIC-HOROSCOPES-V1
// apps/api/src/routes/admin-horoscopes.ts
// ------------------------------------------------------------
// Relecture/édition des horoscopes génériques presse + gestion
// des clés API partenaires. Même garde que admin-panel
// (user JWT + users.is_admin re-checké à chaque requête).
//
//   GET    /admin-panel/horoscopes?cadence=day|week
//   POST   /admin-panel/horoscopes/regenerate   {cadence, signIdx?}
//   PATCH  /admin-panel/horoscopes/:id          {text}
//   GET    /admin-panel/horoscopes/keys
//   POST   /admin-panel/horoscopes/keys         {name} → token (affiché UNE fois)
//   POST   /admin-panel/horoscopes/keys/:id/revoke
// ============================================================

import crypto from "crypto";
import type { FastifyPluginAsync } from "fastify";
import { desc, eq } from "drizzle-orm";

import { requireAdminUser } from "../middleware/requireAdminUser.js";
import { db } from "../db/index.js";
import { partnerApiKeys } from "../db/schema.js";
import {
  ensureGenericHoroscopes,
  getGenericHoroscopes,
  regenerateGenericHoroscopes,
  updateGenericHoroscopeText,
  isHoroscopeCadence,
  SIGN_NAMES_FR,
} from "../services/generic-horoscope.service.js";

const adminHoroscopesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", requireAdminUser);

  // ── Édition courante (génère si absente : l'admin qui ouvre la
  //    page veut voir des textes, pas un état vide) ──
  fastify.get<{ Querystring: { cadence?: string } }>("/", async (req, reply) => {
    const cadence = req.query.cadence ?? "day";
    if (!isHoroscopeCadence(cadence)) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_CADENCE", message: "cadence must be one of: day, week" },
      });
    }
    try {
      await ensureGenericHoroscopes(cadence, req.log);
    } catch (err) {
      req.log.error({ err, cadence }, "[admin-horoscopes] ensure failed");
      // on sert quand même ce qui existe (éventuellement partiel/vide)
    }
    const { periodStart, periodEnd, rows } = await getGenericHoroscopes(cadence);
    return reply.send({
      success: true,
      data: {
        cadence, periodStart, periodEnd,
        signs: rows.map((r) => ({
          id: r.id, signIdx: r.signIdx, sign: SIGN_NAMES_FR[r.signIdx],
          text: r.text, edited: r.edited,
          generatedAt: r.generatedAt, updatedAt: r.updatedAt,
        })),
      },
    });
  });

  // ── Régénération (un signe : écrase ; globale : préserve les edited) ──
  fastify.post<{ Body: { cadence?: string; signIdx?: number } }>(
    "/regenerate",
    {
      schema: {
        body: {
          type: "object",
          required: ["cadence"],
          properties: {
            cadence: { type: "string" },
            signIdx: { type: "integer", minimum: 0, maximum: 11 },
          },
        },
      },
    },
    async (req, reply) => {
      const { cadence, signIdx } = req.body;
      if (!cadence || !isHoroscopeCadence(cadence)) {
        return reply.code(400).send({
          success: false,
          error: { code: "BAD_CADENCE", message: "cadence must be one of: day, week" },
        });
      }
      try {
        const rows = await regenerateGenericHoroscopes(cadence, signIdx ?? null, req.log);
        return reply.send({
          success: true,
          data: {
            signs: rows.map((r) => ({
              id: r.id, signIdx: r.signIdx, sign: SIGN_NAMES_FR[r.signIdx],
              text: r.text, edited: r.edited,
              generatedAt: r.generatedAt, updatedAt: r.updatedAt,
            })),
          },
        });
      } catch (err) {
        req.log.error({ err, cadence, signIdx }, "[admin-horoscopes] regenerate failed");
        return reply.code(502).send({
          success: false,
          error: { code: "GENERATION_FAILED", message: "LLM generation failed — retry later" },
        });
      }
    },
  );

  // ── Retouche manuelle d'un texte ──
  fastify.patch<{ Params: { id: string }; Body: { text?: string } }>(
    "/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["text"],
          properties: { text: { type: "string", minLength: 50, maxLength: 1200 } },
        },
      },
    },
    async (req, reply) => {
      const row = await updateGenericHoroscopeText(req.params.id, req.body.text!);
      if (!row) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "horoscope not found" },
        });
      }
      return reply.send({
        success: true,
        data: {
          id: row.id, signIdx: row.signIdx, sign: SIGN_NAMES_FR[row.signIdx],
          text: row.text, edited: row.edited, updatedAt: row.updatedAt,
        },
      });
    },
  );

  // ── Clés API partenaires ──
  fastify.get("/keys", async (_req, reply) => {
    const rows = await db
      .select({
        id: partnerApiKeys.id, name: partnerApiKeys.name,
        keyPrefix: partnerApiKeys.keyPrefix, active: partnerApiKeys.active,
        createdAt: partnerApiKeys.createdAt, lastUsedAt: partnerApiKeys.lastUsedAt,
      })
      .from(partnerApiKeys)
      .orderBy(desc(partnerApiKeys.createdAt));
    return reply.send({ success: true, data: { keys: rows } });
  });

  fastify.post<{ Body: { name?: string } }>(
    "/keys",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", minLength: 2, maxLength: 120 } },
        },
      },
    },
    async (req, reply) => {
      // Token opaque remis au partenaire — visible UNE SEULE fois
      // (seul le sha256 est stocké).
      const token = `pk_live_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(token).digest("hex");
      const keyPrefix = token.slice(0, 12);
      const inserted = await db
        .insert(partnerApiKeys)
        .values({ name: req.body.name!.trim(), keyPrefix, keyHash })
        .returning({
          id: partnerApiKeys.id, name: partnerApiKeys.name,
          keyPrefix: partnerApiKeys.keyPrefix, createdAt: partnerApiKeys.createdAt,
        });
      return reply.code(201).send({
        success: true,
        data: { ...inserted[0]!, token },
      });
    },
  );

  fastify.post<{ Params: { id: string } }>("/keys/:id/revoke", async (req, reply) => {
    const updated = await db
      .update(partnerApiKeys)
      .set({ active: false })
      .where(eq(partnerApiKeys.id, req.params.id))
      .returning({ id: partnerApiKeys.id });
    if (updated.length === 0) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "key not found" },
      });
    }
    return reply.send({ success: true, data: { id: updated[0]!.id, active: false } });
  });
};

export default adminHoroscopesRoutes;

// GENERIC-HOROSCOPES-V1 admin routes applied
