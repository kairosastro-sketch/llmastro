// ============================================================
// GENERIC-HOROSCOPES-V1
// apps/api/src/routes/partner.ts
// ------------------------------------------------------------
// API partenaire (syndication presse) : sert les horoscopes
// génériques aux clients externes (quotidiens locaux).
//
// Auth : header `x-api-key` — token opaque remis au client,
// stocké hashé (sha256) dans partner_api_keys. Clés gérées
// depuis /admin/horoscopes (admin-panel).
//
//   GET /partner/horoscopes/latest?cadence=day|week
//   GET /partner/horoscopes/2026-06-12?cadence=day|week
//
// Lecture seule : ne déclenche JAMAIS de génération LLM — on sert
// ce qui existe (la génération est portée par le boot horaire).
// ============================================================

import crypto from "crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { partnerApiKeys } from "../db/schema.js";
import {
  getGenericHoroscopes,
  isHoroscopeCadence,
  SIGN_NAMES_FR,
  type HoroscopeCadence,
} from "../services/generic-horoscope.service.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function partnerAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = req.headers["x-api-key"];
  if (typeof key !== "string" || key.length < 16) {
    return reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "x-api-key header required" },
    });
  }
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const rows = await db
    .select({ id: partnerApiKeys.id, active: partnerApiKeys.active })
    .from(partnerApiKeys)
    .where(eq(partnerApiKeys.keyHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row || !row.active) {
    return reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "invalid or revoked API key" },
    });
  }
  // Trace d'usage, fire-and-forget (ne retarde pas la réponse).
  void db
    .update(partnerApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(partnerApiKeys.id, row.id))
    .catch(() => { /* trace best-effort */ });
}

function parseCadence(raw: unknown, reply: FastifyReply): HoroscopeCadence | null {
  const cadence = typeof raw === "string" && raw.length > 0 ? raw : "day";
  if (!isHoroscopeCadence(cadence)) {
    void reply.code(400).send({
      success: false,
      error: { code: "BAD_CADENCE", message: "cadence must be one of: day, week" },
    });
    return null;
  }
  return cadence;
}

async function sendEdition(
  reply: FastifyReply,
  cadence: HoroscopeCadence,
  ref: Date,
): Promise<FastifyReply> {
  const { periodStart, periodEnd, rows } = await getGenericHoroscopes(cadence, ref);
  if (rows.length < 12) {
    return reply.code(404).send({
      success: false,
      error: {
        code: "EDITION_NOT_READY",
        message: `horoscopes ${cadence} not generated yet for this period`,
      },
    });
  }
  return reply.send({
    success: true,
    data: {
      cadence,
      periodStart,
      periodEnd,
      language: "fr",
      signs: rows.map((r) => ({
        signIdx: r.signIdx,
        sign: SIGN_NAMES_FR[r.signIdx],
        text: r.text,
        updatedAt: r.updatedAt,
      })),
    },
  });
}

export async function partnerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { cadence?: string } }>(
    "/horoscopes/latest",
    { preHandler: [partnerAuth], schema: { tags: ["partner"] } },
    async (req, reply) => {
      const cadence = parseCadence(req.query.cadence, reply);
      if (!cadence) return;
      return sendEdition(reply, cadence, new Date());
    },
  );

  fastify.get<{ Params: { date: string }; Querystring: { cadence?: string } }>(
    "/horoscopes/:date",
    { preHandler: [partnerAuth], schema: { tags: ["partner"] } },
    async (req, reply) => {
      const cadence = parseCadence(req.query.cadence, reply);
      if (!cadence) return;
      const { date } = req.params;
      if (!DATE_RE.test(date)) {
        return reply.code(400).send({
          success: false,
          error: { code: "BAD_DATE", message: "date must be YYYY-MM-DD" },
        });
      }
      // Midi UTC : évite tout glissement de période aux bornes de minuit.
      const ref = new Date(`${date}T12:00:00.000Z`);
      if (Number.isNaN(ref.getTime())) {
        return reply.code(400).send({
          success: false,
          error: { code: "BAD_DATE", message: "invalid date" },
        });
      }
      return sendEdition(reply, cadence, ref);
    },
  );
}

// GENERIC-HOROSCOPES-V1 partner routes applied
