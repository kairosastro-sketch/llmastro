// ============================================================
// ANALYTICS-V1
// apps/api/src/routes/analytics.ts
// ------------------------------------------------------------
// Route publique d'ingestion des page views (mesure d'audience).
// - Périmètre : tous les visiteurs. Anonyme via cookie `aid`
//   (httpOnly, 1 an, SameSite=Lax) ; rattaché à un user si un JWT
//   d'accès valide est présent (best-effort, jamais bloquant).
// - Compatible navigator.sendBeacon : accepte `text/plain` (un
//   Blob JSON envoyé en text/plain évite tout preflight CORS).
// ============================================================

import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload } from "@astro-platform/types";
import { logPageView } from "../services/analytics.service.js";

const ANON_COOKIE = "aid";
const ANON_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 an (cookie `cookie` = secondes)

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // sendBeacon envoie un Blob JSON typé text/plain pour rester une
  // « simple request » (pas de preflight). On parse ce corps en JSON.
  // Parser encapsulé à ce plugin uniquement.
  fastify.addContentTypeParser(
    "text/plain",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        done(null, body ? JSON.parse(body as string) : {});
      } catch {
        done(null, {});
      }
    }
  );

  fastify.post<{
    Body: { path?: string; activeMs?: number; referrer?: string | null };
  }>(
    "/pageview",
    {
      // Audience = beaucoup d'événements légitimes par visiteur.
      // Limite large pour ne pas écrêter une navigation normale.
      config: { rateLimit: { max: 240, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          required: ["path"],
          properties: {
            path:     { type: "string", minLength: 1, maxLength: 512 },
            activeMs: { type: "number", minimum: 0, maximum: 1800000 },
            referrer: { type: ["string", "null"], maxLength: 512 },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      // ── Anon id : lit le cookie, le pose si absent ──
      let anonId = req.cookies[ANON_COOKIE];
      if (!anonId || anonId.length < 8 || anonId.length > 64) {
        anonId = randomUUID();
        reply.setCookie(ANON_COOKIE, anonId, {
          httpOnly: true,
          secure:   process.env["NODE_ENV"] === "production",
          sameSite: "lax",
          path:     "/",
          maxAge:   ANON_MAX_AGE_SEC,
        });
      }

      // ── User id (best-effort, jamais bloquant) ──
      let userId: string | null = null;
      try {
        const payload = await req.jwtVerify<JWTPayload>();
        if (payload?.type === "access" && payload.sub) userId = payload.sub;
      } catch {
        /* visiteur non connecté : on garde l'anon id */
      }

      logPageView({
        userId,
        sessionId: anonId,
        path:      req.body.path ?? "/",
        activeMs:  req.body.activeMs ?? 0,
        referrer:  req.body.referrer ?? null,
      });

      // 204 : pas de corps utile, et léger pour sendBeacon.
      return reply.code(204).send();
    }
  );
};

export default analyticsRoutes;

// ANALYTICS-V1 applied
