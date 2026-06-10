import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload, NatalDataCreate } from "@astro-platform/types";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { natalService } from "../services/natal.service.js";
import { entitlementsService } from "../services/entitlements.service.js"; // ARCHIVE-4-GATES-V1
import { localToUTC, computeAstrocartography, ephemerisService, findCrossParans, ACG_SLOW_BODY_KEYS } from "@astro-platform/ephemeris"; // ASTROCARTOGRAPHY-V1
import { createHash } from "node:crypto";
import {
  deriveAstrocartographyFacts,
  buildAstrocartographyReadingMessages,
  type AcgActivation,
} from "../services/astrocartography-reading.service.js";
import { getOrGenerateAstrocartographyReading } from "../services/readings.helpers.js";
import { computeTransitAspects } from "../services/transits.service.js"; // hook transits

// ── CYCLOCARTOGRAPHY-V1 — curseur de dates sur la carte personnelle ─────
// Carte natale FIGÉE + couche de transits lents qui dérive (±12 mois), avec
// les croisements transit×natal = points d'activation du moment.
const CYCLO_SPAN = 12;            // ±12 mois
const CYCLO_LAT_STEP = 3;         // échantillonnage courbes (payload + perf)
const CYCLO_TTL_MS = 6 * 60 * 60 * 1000;
const CYCLO_MAX_CROSS = 24;       // croisements transit×natal gardés par mois (les plus forts)

// Poids de pertinence d'une activation transit×natal (réduit le bruit : ~150
// croisements bruts/mois → on garde les plus parlants).
//  - angles : MC/AC (visibilité, identité) > IC/DC (leurs opposés).
//  - corps natal touché : luminaires & planètes perso > planètes lentes natales
//    (un transit sur TON Soleil parle plus que sur ton Pluton natal).
//  - corps en transit : Saturne/Pluton (structurants) en tête.
const CYCLO_ANGLE_W: Record<string, number> = { MC: 1.0, AC: 0.9, IC: 0.5, DC: 0.45 };
const CYCLO_TRANSIT_W: Record<string, number> = {
  saturn: 1.0, pluto: 1.0, neptune: 0.92, uranus: 0.9, jupiter: 0.82, northNode: 0.78,
};
const CYCLO_NATAL_W: Record<string, number> = {
  sun: 1.0, moon: 1.0, venus: 0.9, mars: 0.9, mercury: 0.85,
  jupiter: 0.75, saturn: 0.75, uranus: 0.6, neptune: 0.6, pluto: 0.6,
};
function cycloScore(c: { aKey: string; bKey: string; aAngle: string; bAngle: string }): number {
  return (CYCLO_ANGLE_W[c.aAngle] ?? 0.5) * (CYCLO_ANGLE_W[c.bAngle] ?? 0.5)
    * (CYCLO_TRANSIT_W[c.aKey] ?? 0.7) * (CYCLO_NATAL_W[c.bKey] ?? 0.6);
}

// Cache par (natalId, mois courant). Petit : peu de profils consultés à la fois.
const cycloCache = new Map<string, { data: unknown; expiresAt: number }>();
const CYCLO_CACHE_MAX = 32;

function r1c(x: number): number { return Math.round(x * 10) / 10; }
function jdFromDateUTC(d: Date): number { return d.getTime() / 86400000 + 2440587.5; }

function slimCycloLine(l: {
  key: string; mcLng: number; icLng: number;
  asc: { lat: number; lng: number }[]; dsc: { lat: number; lng: number }[];
}) {
  return {
    key: l.key, mcLng: r1c(l.mcLng), icLng: r1c(l.icLng),
    asc: l.asc.map((p) => ({ lat: r1c(p.lat), lng: r1c(p.lng) })),
    dsc: l.dsc.map((p) => ({ lat: r1c(p.lat), lng: r1c(p.lng) })),
  };
}

/** Croisement transit×natal → champs tKey/nKey explicites + coords arrondies + score. */
function slimCross(p: {
  aKey: string; bKey: string; aAngle: string; bAngle: string; lat: number; lng: number;
}) {
  return {
    tKey: p.aKey, nKey: p.bKey,        // a = transit, b = natal
    tAngle: p.aAngle, nAngle: p.bAngle,
    lat: r1c(p.lat), lng: r1c(p.lng),
    s: Math.round(cycloScore(p) * 100) / 100,  // pertinence 0–1 (sizing front)
  };
}

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
  // GET /natal/:id/astrocartography/timeline  (CYCLOCARTOGRAPHY-V1)
  // Curseur de dates de la carte PERSONNELLE. La carte natale reste figée
  // (route ci-dessus) ; ici on renvoie, par mois (±12), la couche de TRANSIT
  // lente (Jupiter→Pluton + Nœud) + les croisements transit×natal = les
  // points d'ACTIVATION du moment. Premium (astro.cartography).
  // --------------------------------------------------------
  fastify.get<{ Params: { id: string } }>("/:id/astrocartography/timeline", async (req, reply) => {
    const { sub: userId } = req.user as JWTPayload;

    const allowed = await entitlementsService.check(userId, "astro.cartography");
    if (!allowed) {
      if (entitlementsService.isEnforcementActive()) {
        return reply.code(403).send({
          success: false,
          error: {
            code: "FEATURE_NOT_AVAILABLE",
            message: "La cyclocartographie personnelle demande un plan supérieur.",
            feature: "astro.cartography",
          },
        });
      }
      req.log.warn({ userId }, "[entitlements] would deny natal cyclocartography (enforcement off)");
    }

    const profile = await natalService.findOne(req.params.id, userId);
    if (!profile) {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Natal profile not found" },
      });
    }

    const now = new Date();
    const cacheKey = `${profile.id}:${now.getUTCFullYear()}-${now.getUTCMonth()}`;
    const cached = cycloCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return reply.send({ success: true, data: cached.data, cached: true });
    }

    try {
      // Lignes natales FIXES (10 corps), échantillonnées plus large : elles ne
      // servent qu'à détecter les croisements, pas à l'affichage (la carte
      // natale visible vient de /:id/astrocartography en pleine résolution).
      const { jdUT: jdBirth } = localToUTC(profile.birthDate, profile.birthTime, profile.timezone);
      const natalLines = computeAstrocartography(jdBirth, { latStep: CYCLO_LAT_STEP }).lines;

      const frames = [];
      for (let off = -CYCLO_SPAN; off <= CYCLO_SPAN; off++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + off, 15, 12, 0, 0));
        const transit = computeAstrocartography(jdFromDateUTC(d), {
          bodyKeys: ACG_SLOW_BODY_KEYS,
          latStep:  CYCLO_LAT_STEP,
        });
        // ~150 croisements bruts → on garde les CYCLO_MAX_CROSS plus pertinents.
        const crossings = findCrossParans(transit.lines, natalLines)
          .map(slimCross)
          .sort((a, b) => b.s - a.s)
          .slice(0, CYCLO_MAX_CROSS);
        frames.push({
          offset:    off,
          date:      d.toISOString(),
          jd:        transit.jd,
          lines:     transit.lines.map(slimCycloLine),  // couche transit (affichée)
          crossings,                                    // transit×natal (activations), top-N
        });
      }

      const payload = {
        generatedAt:    now.toISOString(),
        span:           CYCLO_SPAN,
        anchorIndex:    CYCLO_SPAN,
        bodyKeys:       ACG_SLOW_BODY_KEYS,
        natalId:        profile.id,
        birthTimeKnown: !profile.birthTimeUnknown,
        frames,
      };

      // Cache + purge best-effort.
      cycloCache.set(cacheKey, { data: payload, expiresAt: Date.now() + CYCLO_TTL_MS });
      if (cycloCache.size > CYCLO_CACHE_MAX) {
        const oldest = [...cycloCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        for (const [k] of oldest.slice(0, cycloCache.size - CYCLO_CACHE_MAX)) cycloCache.delete(k);
      }

      return reply.send({ success: true, data: payload, cached: false });
    } catch (err) {
      req.log.error({ err }, "[natal] cyclocartography timeline failed");
      return reply.code(500).send({
        success: false,
        error: { code: "EPHEMERIS_ERROR", message: "Failed to compute cyclocartography timeline" },
      });
    }
  });

  // --------------------------------------------------------
  // GET /natal/:id/astrocartography/reading  (ASTROCARTOGRAPHY-V1)
  // « Lecture de vos lieux » : interprétation LLM (ton Kairos) des lignes /
  // parans natals les plus forts, cachée par profil (carte fixe). Premium.
  // --------------------------------------------------------
  fastify.get<{
    Params: { id: string };
    Querystring: { locale?: string; lat?: string; lng?: string; place?: string };
  }>(
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

      // Lieu ancré : un lieu requêté (mode « explorer ») sinon la ville de naissance.
      const qLat = req.query.lat != null ? Number(req.query.lat) : NaN;
      const qLng = req.query.lng != null ? Number(req.query.lng) : NaN;
      const hasQueryPlace = Number.isFinite(qLat) && Number.isFinite(qLng)
        && qLat >= -90 && qLat <= 90 && qLng >= -180 && qLng <= 180;
      const anchor = hasQueryPlace
        ? { name: (req.query.place || "ce lieu").slice(0, 80), lat: qLat, lng: qLng }
        : { name: profile.birthCity || "votre lieu de naissance", lat: profile.latitude, lng: profile.longitude };

      try {
        const { jdUT } = localToUTC(profile.birthDate, profile.birthTime, profile.timezone);
        const acg = computeAstrocartography(jdUT);
        const birthTimeKnown = !profile.birthTimeUnknown;

        // Hook temporel : aspects transit→natal du moment → planètes natales activées.
        let activations: AcgActivation[] = [];
        try {
          const natalChart = await ephemerisService.calculateNatalChart({
            natalId: profile.id,
            localBirthDate: profile.birthDate, localBirthTime: profile.birthTime,
            ianaTz: profile.timezone, latitude: profile.latitude, longitude: profile.longitude,
            birthTimeKnown,
          });
          const now = new Date();
          const transitChart = await ephemerisService.calculateNatalChart({
            natalId: `acgtr_${profile.id}_${Math.floor(now.getTime() / 3.6e6)}`,
            localBirthDate: now.toISOString().slice(0, 10),
            localBirthTime: `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
            ianaTz: "UTC", latitude: profile.latitude, longitude: profile.longitude,
            birthTimeKnown: true,
          });
          activations = computeTransitAspects(
            transitChart.planets as any, natalChart.planets as any,
          )
            .filter((a) => a.tight)
            .map((a) => ({ transitPlanet: a.transitPlanet, natalPlanet: a.natalPlanet, typeFr: a.typeFr, tone: a.tone }));
        } catch (e) {
          req.log.warn({ e }, "[natal] transit activations failed — reading continues sans hook");
        }

        const { factsText, hasContent } = deriveAstrocartographyFacts(acg, anchor, activations);
        if (!hasContent) {
          return reply.send({
            success: true,
            data: { text: "", anchor: anchor.name, natalLabel: profile.label, birthTimeKnown },
          });
        }

        const messages = buildAstrocartographyReadingMessages(
          factsText, profile.label, anchor.name, birthTimeKnown, locale,
        );

        // Cache : invalide si naissance change ; bucket HEBDO (le hook transit
        // évolue) ; distinct par lieu ancré.
        const digest = createHash("sha1")
          .update([profile.birthDate, profile.birthTime, profile.timezone,
                   profile.latitude, profile.longitude, profile.birthTimeUnknown].join("|"))
          .digest("hex").slice(0, 10);
        const anchorKey = hasQueryPlace ? `${qLat.toFixed(1)}_${qLng.toFixed(1)}` : "birth";
        const week = Math.floor(Date.now() / (7 * 86400000));

        const reading = await getOrGenerateAstrocartographyReading({
          userId,
          natalProfileId: profile.id,
          keySuffix: `${digest}:${anchorKey}:w${week}:${locale}`,
          messages,
          options: { userId, temperature: 0.85, maxTokens: 900 },
        });

        const text = (reading.content as { text?: string })?.text ?? "";
        return reply.send({
          success: true,
          data: { text, anchor: anchor.name, natalLabel: profile.label, birthTimeKnown },
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
