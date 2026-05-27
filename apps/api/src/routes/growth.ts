// GROWTH-V1-CAPTURE
// Routes publiques + authentifiées pour le chantier growth.
//   POST /affiliate/clicks   (public)   — journal des clics, appelé
//                                          côté middleware Next.js
//   GET  /referrals/me       (auth)     — code de parrainage + stats
//   GET  /affiliate/me       (auth)     — stats affiliés du user
//                                          (404 si pas affilié)
//
// Spec : GROWTH_PLAN.md (sections "Surface UI" parrainage + affiliation).

import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { db } from "../db/index.js";
import { affiliates } from "../db/schema.js";
import { growthService } from "../services/growth.service.js";
import { resolveTerms } from "../config/affiliate-tiers.config.js";

// ----------------------------------------------------------
// Schemas
// ----------------------------------------------------------
const logClickSchema = {
  body: {
    type: "object",
    required: ["slug"],
    properties: {
      slug:        { type: "string", maxLength: 40 },
      landingUrl:  { type: "string", maxLength: 2048 },
      utmSource:   { type: "string", maxLength: 100 },
      utmMedium:   { type: "string", maxLength: 100 },
      utmCampaign: { type: "string", maxLength: 100 },
    },
    additionalProperties: false,
  },
} as const;

interface LogClickBody {
  slug:         string;
  landingUrl?:  string;
  utmSource?:   string;
  utmMedium?:   string;
  utmCampaign?: string;
}

// GROWTH-V1-AFFILIATE-UI : candidature publique
const applySchema = {
  body: {
    type: "object",
    required: ["displayName", "email", "socialHandle"],
    properties: {
      displayName:  { type: "string", minLength: 2, maxLength: 100 },
      email:        { type: "string", format: "email", maxLength: 255 },
      socialHandle: { type: "string", minLength: 2, maxLength: 200 },
      audienceSize: { type: "string", maxLength: 50 },
      motivation:   { type: "string", maxLength: 2000 },
    },
    additionalProperties: false,
  },
} as const;

interface ApplyBody {
  displayName:   string;
  email:         string;
  socialHandle:  string;
  audienceSize?: string;
  motivation?:   string;
}

// ----------------------------------------------------------
// Plugin
// ----------------------------------------------------------
export const growthRoutes: FastifyPluginAsync = async (fastify) => {

  // ----------------------------------------------------------
  // POST /affiliate/clicks
  // Public, sans auth — appelé par le middleware Next.js à chaque
  // landing avec ?aff= valide. Rate-limit explicite pour limiter
  // l'abus, 60/min/IP (la vraie surface attendue est faible).
  // ----------------------------------------------------------
  fastify.post<{ Body: LogClickBody }>(
    "/affiliate/clicks",
    {
      schema: { ...logClickSchema, tags: ["growth"] },
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const visitorHash = growthService.hashVisitor(
        req.ip ?? null,
        req.headers["user-agent"] ?? null,
      );

      const result = await growthService.logAffiliateClick({
        slug:        req.body.slug,
        visitorHash,
        landingUrl:  req.body.landingUrl  ?? null,
        utmSource:   req.body.utmSource   ?? null,
        utmMedium:   req.body.utmMedium   ?? null,
        utmCampaign: req.body.utmCampaign ?? null,
      });

      // On répond toujours 200 — un slug invalide ne doit pas donner
      // d'info à un attaquant qui essaierait d'énumérer les affiliés.
      return reply.send({ success: true, data: { logged: result.logged } });
    },
  );

  // ----------------------------------------------------------
  // GET /referrals/me
  // Auth requise. Toujours retourne un objet stats — si le user n'a
  // pas encore de code, il est généré ici (idempotent).
  // ----------------------------------------------------------
  fastify.get(
    "/referrals/me",
    {
      schema: { tags: ["growth"] },
      preHandler: authMiddleware,
    },
    async (req, reply) => {
      const userId = req.authContext!.userId;
      const stats = await growthService.getReferralStats(userId);
      return reply.send({ success: true, data: stats });
    },
  );

  // ----------------------------------------------------------
  // [GROWTH-V1-GIFT-CODES]
  // GET /referrals/me/gifts — codes cadeaux émis par ce user (Pro).
  // Auth requise. Retourne max 50 codes ordonnés desc par création.
  // Renvoie array vide si le user n'a jamais généré de code.
  // ----------------------------------------------------------
  fastify.get(
    "/referrals/me/gifts",
    {
      schema: { tags: ["growth"] },
      preHandler: authMiddleware,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const userId = req.authContext!.userId;
      const codes = await growthService.listIssuedGiftCodes(userId);
      return reply.send({ success: true, data: { codes } });
    },
  );

  // ----------------------------------------------------------
  // GET /affiliate/me
  // Auth requise. 404 si l'user n'a pas de ligne affiliates active.
  // Retourne les conditions effectives courantes (resolveTerms) —
  // l'historique des attributions reste figé via les snapshots.
  // ----------------------------------------------------------
  fastify.get(
    "/affiliate/me",
    {
      schema: { tags: ["growth"] },
      preHandler: authMiddleware,
    },
    async (req, reply) => {
      const userId = req.authContext!.userId;
      const [aff] = await db
        .select()
        .from(affiliates)
        .where(eq(affiliates.userId, userId))
        .limit(1);

      if (!aff) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_AFFILIATE", message: "User is not an affiliate" },
        });
      }

      const terms = resolveTerms(aff);
      return reply.send({
        success: true,
        data: {
          id:          aff.id,
          slug:        aff.slug,
          displayName: aff.displayName,
          status:      aff.status,
          tier:        aff.tier,
          terms,
        },
      });
    },
  );

  // ----------------------------------------------------------
  // GROWTH-V1-AFFILIATE-UI
  // GET /affiliate/me/stats  — stats détaillées pour le dashboard
  // POST /affiliate/apply    — candidature publique au programme
  // ----------------------------------------------------------
  fastify.get(
    "/affiliate/me/stats",
    {
      schema: { tags: ["growth"] },
      preHandler: authMiddleware,
    },
    async (req, reply) => {
      const userId = req.authContext!.userId;
      const stats = await growthService.getAffiliateStats(userId);
      if (!stats) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_AFFILIATE", message: "User is not an affiliate" },
        });
      }
      return reply.send({ success: true, data: stats });
    },
  );

  fastify.post<{ Body: ApplyBody }>(
    "/affiliate/apply",
    {
      schema: { ...applySchema, tags: ["growth"] },
      // Rate-limit strict — c'est une endpoint publique sans auth,
      // 3/min/IP suffit largement pour un usage humain et bloque le
      // spam automatisé. L'admin pourra de toute façon trier les
      // candidatures avant de leur donner accès à un lien.
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const { id, slug } = await growthService.submitApplication({
        displayName:  req.body.displayName,
        email:        req.body.email,
        socialHandle: req.body.socialHandle,
        audienceSize: req.body.audienceSize,
        motivation:   req.body.motivation,
      });
      return reply.code(201).send({ success: true, data: { id, slug } });
    },
  );
};

// GROWTH-V1-CAPTURE applied
// GROWTH-V1-AFFILIATE-UI applied
