import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { natalService } from "../services/natal.service.js";
import { ephemerisService } from "@astro-platform/ephemeris";
import { entitlementsService } from "../services/entitlements.service.js"; // ARCHIVE-4-GATES-V1
import {
  computeTransitAspects,
  computeHouseActivations,
  generateAlerts,
} from "../services/transits.service.js";

export const transitsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authMiddleware);

  // ── GET /transits/current/:natalId ──────────────────────
  fastify.get<{ Params: { natalId: string }; Querystring: { locale?: string } }>(
    "/current/:natalId",
    async (req, reply) => {
      const { sub: userId } = req.user as JWTPayload;

      // ARCHIVE-4-GATES-V1 : gate booléenne transits.biwheel
      const allowed = await entitlementsService.check(userId, "transits.biwheel");
      if (!allowed) {
        if (entitlementsService.isEnforcementActive()) {
          return reply.code(403).send({
            success: false,
            error: {
              code:    "FEATURE_NOT_AVAILABLE",
              message: "La vue biwheel des transits demande un plan supérieur.",
              feature: "transits.biwheel",
            },
          });
        }
        req.log.warn({ userId }, "[entitlements] would deny transits/current (enforcement off)");
      }

      const natal = await natalService.findOne(req.params.natalId, userId);
      if (!natal) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Profil natal non trouvé" },
        });
      }

      const locale = req.query.locale === "en" ? "en" : "fr";

      try {
        // 1) Carte natale (mise en cache Redis via ephemerisService)
        const natalChart = await ephemerisService.calculateNatalChart({
          natalId: natal.id,
          localBirthDate: natal.birthDate,
          localBirthTime: natal.birthTime,
          ianaTz: natal.timezone,
          latitude: natal.latitude,
          longitude: natal.longitude,
          birthTimeKnown: !natal.birthTimeUnknown,
        });

        // 2) Ciel actuel — positions courantes
        //    Cache par heure pour éviter les recalculs fréquents
        const now = new Date();
        const nowDateStr = now.toISOString().slice(0, 10);
        const nowTimeStr =
          String(now.getUTCHours()).padStart(2, "0") + ":" +
          String(now.getUTCMinutes()).padStart(2, "0");
        const hourBucket = Math.floor(now.getTime() / (1000 * 60 * 60));
        const transitCacheId = `transit_${userId}_${hourBucket}`;

        const transitChart = await ephemerisService.calculateNatalChart({
          natalId: transitCacheId,
          localBirthDate: nowDateStr,
          localBirthTime: nowTimeStr,
          ianaTz: "UTC",
          latitude: natal.latitude,
          longitude: natal.longitude,
          birthTimeKnown: true,
        });

        // 3) Aspects transit → natal
        const aspects = computeTransitAspects(
          transitChart.planets as any,
          natalChart.planets as any,
        );

        // 4) Activations de maisons
        const houseActivations = computeHouseActivations(
          transitChart.planets as any,
          natalChart.houses as any,
        );

        // 5) Alertes
        const alerts = generateAlerts(aspects, transitChart.planets as any, locale);

        return reply.send({
          success: true,
          data: {
            date: now.toISOString(),
            natalId: natal.id,
            natalLabel: natal.label ?? "",
            transits: {
              planets: transitChart.planets,
              moonPhase: transitChart.moonPhase,
              retrogrades: transitChart.retrogrades,
            },
            natal: {
              planets: natalChart.planets,
              houses: natalChart.houses,
              asc: natalChart.asc,
              mc: natalChart.mc,
            },
            aspects: aspects.slice(0, 25),
            aspectsCount: aspects.length,
            exactAspectsCount: aspects.filter(a => a.exact).length,
            houseActivations,
            alerts,
          },
        });
      } catch (err) {
        fastify.log.error({ err }, "Transit calculation failed");
        return reply.code(500).send({
          success: false,
          error: {
            code: "TRANSIT_ERROR",
            message: err instanceof Error ? err.message : "Erreur de calcul",
          },
        });
      }
    },
  );

  // ── GET /transits/sky — Ciel du moment (sans natal) ─────
  fastify.get<{ Querystring: { lat?: string; lon?: string } }>(
    "/sky",
    async (req, reply) => {
      try {
        const lat = req.query.lat ? parseFloat(req.query.lat) : 48.8566; // Paris
        const lon = req.query.lon ? parseFloat(req.query.lon) : 2.3522;

        const now = new Date();
        const nowDateStr = now.toISOString().slice(0, 10);
        const nowTimeStr =
          String(now.getUTCHours()).padStart(2, "0") + ":" +
          String(now.getUTCMinutes()).padStart(2, "0");
        const hourBucket = Math.floor(now.getTime() / (1000 * 60 * 60));

        const sky = await ephemerisService.calculateNatalChart({
          natalId: `sky_${hourBucket}_${lat.toFixed(1)}_${lon.toFixed(1)}`,
          localBirthDate: nowDateStr,
          localBirthTime: nowTimeStr,
          ianaTz: "UTC",
          latitude: lat,
          longitude: lon,
          birthTimeKnown: true,
        });

        return reply.send({
          success: true,
          data: {
            date: now.toISOString(),
            location: { lat, lon },
            planets: sky.planets,
            moonPhase: sky.moonPhase,
            retrogrades: sky.retrogrades,
          },
        });
      } catch (err) {
        fastify.log.error({ err }, "Sky calculation failed");
        return reply.code(500).send({
          success: false,
          error: {
            code: "SKY_ERROR",
            message: err instanceof Error ? err.message : "Erreur",
          },
        });
      }
    },
  );
};

// CI-DEBT-PURGE-V1-F applied
