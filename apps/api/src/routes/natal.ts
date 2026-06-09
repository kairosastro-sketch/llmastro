import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload, NatalDataCreate } from "@astro-platform/types";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { natalService } from "../services/natal.service.js";
import { entitlementsService } from "../services/entitlements.service.js"; // ARCHIVE-4-GATES-V1
import { localToUTC, computeAstrocartography } from "@astro-platform/ephemeris"; // ASTROCARTOGRAPHY-V1
import { createHash } from "node:crypto";
import {
  deriveAstrocartographyFacts,
  buildAstrocartographyReadingMessages,
} from "../services/astrocartography-reading.service.js";
import { getOrGenerateAstrocartographyReading } from "../services/readings.helpers.js";

const createSchema = {
  body: {
    type: "object",
    required: ["label", "birthDate", "birthTime", "latitude", "longitude", "timezone", "birthCity", "birthCountry"],
    properties: {
      label:            { type: "string", minLength: 1, maxLength: 50 },
      birthDate:        { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      birthTime:        { type: "string", pattern: "^\\d{2}:\\d{2}$" },
      birthTimeUnknown: { type: "boolean", default: false },
      latitude:         { type: "number", minimum: -90,  maximum: 90 },
      longitude:        { type: "number", minimum: -180, maximum: 180 },
      timezone:         { type: "string", maxLength: 50 },
      birthCity:        { type: "string", maxLength: 100 },
      birthCountry:     { type: "string", maxLength: 100 },
      gender:             { type: "string", enum: ["male", "female", "unspecified"] },
      relationshipStatus: { type: "string", enum: ["single", "couple", "unspecified"] },
    },
    additionalProperties: false,
  },
} as const;

export const natalRoutes: FastifyPluginAsync = async (fastify) => {

  // All natal routes require auth
  fastify.addHook("preHandler", authMiddleware);

  // --------------------------------------------------------
  // GET /natal — list user's natal profiles
  // --------------------------------------------------------
  fastify.get("/", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const profiles = await natalService.findByUser(userId);
    return reply.send({ success: true, data: { profiles } });
  });

  // --------------------------------------------------------
  // POST /natal — create natal profile
  // --------------------------------------------------------
  fastify.post<{ Body: NatalDataCreate }>(
    "/",
    { schema: { ...createSchema, tags: ["natal"] } },
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;

      // ARCHIVE-4-GATES-V1 : cap stock natal.profiles.max (vérification inline,
      // pas de middleware standard pour les limites de stock).
      const ent = await entitlementsService.getEntitlement(userId, "natal.profiles.max");
      const max = typeof ent?.value === "number" ? ent.value : 1;
      if (max !== -1) {
        const existing = await natalService.findByUser(userId);
        if (existing.length >= max) {
          if (entitlementsService.isEnforcementActive()) {
            return reply.code(403).send({
              success: false,
              error: {
                code:    "FEATURE_NOT_AVAILABLE",
                message: `Tu as atteint le maximum de ${max} profil${max > 1 ? "s" : ""} natal${max > 1 ? "s" : ""}. Passe à un plan supérieur pour en créer plus.`,
                feature: "natal.profiles.max",
              },
            });
          }
          req.log.warn({ userId, max, existing: existing.length }, "[entitlements] would deny natal create (enforcement off)");
        }
      }

      const profile = await natalService.create(userId, req.body);
      return reply.code(201).send({ success: true, data: { profile } });
    }
  );

  // --------------------------------------------------------
  // GET /natal/:id
  // --------------------------------------------------------
  fastify.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    const profile = await natalService.findOne(req.params.id, userId);

    if (!profile) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Natal profile not found" },
      });
    }

    return reply.send({ success: true, data: { profile } });
  });

  // --------------------------------------------------------
  // GET /natal/:id/astrocartography  (ASTROCARTOGRAPHY-V1)
  // Carte PERSONNELLE : lignes AC/MC/DC/IC + parans des planètes natales
  // projetées sur Terre (instant = naissance → carte FIXE par profil).
  // Réservée aux plans payants (entitlement astro.cartography).
  // --------------------------------------------------------
  fastify.get<{ Params: { id: string } }>("/:id/astrocartography", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;

    // Gate premium — même pattern que transits.biwheel.
    const allowed = await entitlementsService.check(userId, "astro.cartography");
    if (!allowed) {
      if (entitlementsService.isEnforcementActive()) {
        return reply.code(403).send({
          success: false,
          error: {
            code:    "FEATURE_NOT_AVAILABLE",
            message: "La carte d'astrocartographie personnelle demande un plan supérieur.",
            feature: "astro.cartography",
          },
        });
      }
      req.log.warn({ userId }, "[entitlements] would deny natal astrocartography (enforcement off)");
    }

    const profile = await natalService.findOne(req.params.id, userId);
    if (!profile) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Natal profile not found" },
      });
    }

    try {
      // Instant de naissance → JD UT. Carte fixe (positions natales projetées).
      const { jdUT } = localToUTC(profile.birthDate, profile.birthTime, profile.timezone);
      const acg = computeAstrocartography(jdUT);
      return reply.send({
        success: true,
        data: {
          natalId:        profile.id,
          natalLabel:     profile.label,
          birthDate:      profile.birthDate,
          // L'heure pilote les lignes MC/IC/AC/DC : si inconnue, la carte est
          // indicative (le front le signale).
          birthTimeKnown: !profile.birthTimeUnknown,
          jd:     acg.jd,
          gst:    acg.gst,
          bodies: acg.bodies,
          lines:  acg.lines,
          parans: acg.parans,
        },
      });
    } catch (err) {
      req.log.error({ err }, "[natal] astrocartography compute failed");
      return reply.code(500).send({
        success: false,
        error: { code: "EPHEMERIS_ERROR", message: "Failed to compute astrocartography" },
      });
    }
  });

  // --------------------------------------------------------
  // GET /natal/:id/astrocartography/reading  (ASTROCARTOGRAPHY-V1)
  // « Lecture de vos lieux » : interprétation LLM (ton Kairos) des lignes /
  // parans natals les plus forts, cachée par profil (carte fixe). Premium.
  // --------------------------------------------------------
  fastify.get<{ Params: { id: string }; Querystring: { locale?: string } }>(
    "/:id/astrocartography/reading",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;

      const allowed = await entitlementsService.check(userId, "astro.cartography");
      if (!allowed) {
        if (entitlementsService.isEnforcementActive()) {
          return reply.code(403).send({
            success: false,
            error: {
              code:    "FEATURE_NOT_AVAILABLE",
              message: "La lecture de vos lieux demande un plan supérieur.",
              feature: "astro.cartography",
            },
          });
        }
        req.log.warn({ userId }, "[entitlements] would deny astrocartography reading (enforcement off)");
      }

      const profile = await natalService.findOne(req.params.id, userId);
      if (!profile) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Natal profile not found" },
        });
      }

      const locale = req.query.locale === "en" ? "en" : "fr";

      try {
        const { jdUT } = localToUTC(profile.birthDate, profile.birthTime, profile.timezone);
        const acg = computeAstrocartography(jdUT);
        const { factsText, hasContent } = deriveAstrocartographyFacts(acg);

        if (!hasContent) {
          return reply.send({
            success: true,
            data: { text: "", natalLabel: profile.label, birthTimeKnown: !profile.birthTimeUnknown },
          });
        }

        const birthTimeKnown = !profile.birthTimeUnknown;
        const messages = buildAstrocartographyReadingMessages(
          factsText, profile.label, birthTimeKnown, locale,
        );

        // Clé de cache : invalide si les données de naissance changent.
        const digest = createHash("sha1")
          .update([profile.birthDate, profile.birthTime, profile.timezone,
                   profile.latitude, profile.longitude, profile.birthTimeUnknown].join("|"))
          .digest("hex").slice(0, 12);

        const reading = await getOrGenerateAstrocartographyReading({
          userId,
          natalProfileId: profile.id,
          keySuffix: `${digest}:${locale}`,
          messages,
          options: { userId, temperature: 0.85, maxTokens: 900 },
        });

        const text = (reading.content as { text?: string })?.text ?? "";
        return reply.send({
          success: true,
          data: { text, natalLabel: profile.label, birthTimeKnown },
        });
      } catch (err) {
        req.log.error({ err }, "[natal] astrocartography reading failed");
        return reply.code(500).send({
          success: false,
          error: { code: "AI_ERROR", message: "Failed to generate reading" },
        });
      }
    },
  );

  // --------------------------------------------------------
  // PATCH /natal/:id
  // --------------------------------------------------------
  fastify.patch<{ Params: { id: string }; Body: Partial<NatalDataCreate> }>(
    "/:id",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;
      const profile = await natalService.update(req.params.id, userId, req.body);

      if (!profile) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Natal profile not found" },
        });
      }

      return reply.send({ success: true, data: { profile } });
    }
  );

  // --------------------------------------------------------
  // DELETE /natal/:id
  // --------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;
    await natalService.delete(req.params.id, userId);
    return reply.code(204).send();
  });
};
