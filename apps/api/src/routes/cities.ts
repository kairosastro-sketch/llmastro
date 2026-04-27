// ============================================================
// apps/api/src/routes/cities.ts
// ------------------------------------------------------------
// Route publique d'autocomplete de villes.
//
// GET /cities/search?q=Marse&limit=10&country=FR
//
// → 200 { success: true, data: { results: CitySearchResult[] } }
//
// Note : volontairement non protégée par auth — l'autocomplete
// fonctionne sur la page d'inscription, donc avant login.
// Rate-limit serré (30 req/min par IP) pour limiter le scraping.
// ============================================================

import type { FastifyPluginAsync } from "fastify";
import {
  searchCities,
  getCityById,
  type CitySearchResult,
} from "../services/cities.service.js";

const searchSchema = {
  querystring: {
    type: "object",
    required: ["q"],
    properties: {
      q:       { type: "string", minLength: 1, maxLength: 100 },
      limit:   { type: "integer", minimum: 1, maximum: 25, default: 10 },
      country: { type: "string", minLength: 2, maxLength: 2, pattern: "^[A-Za-z]{2}$" },
    },
    additionalProperties: false,
  },
} as const;

interface SearchQuery {
  q:        string;
  limit?:   number;
  country?: string;
}

export const citiesRoutes: FastifyPluginAsync = async (fastify) => {

  // --------------------------------------------------------
  // GET /cities/search — autocomplete public
  // --------------------------------------------------------
  fastify.get<{ Querystring: SearchQuery }>(
    "/search",
    {
      schema: { ...searchSchema, tags: ["cities"] },
      // Rate limit dédié : 30 req/min par IP. Le composant
      // frontend doit débouncer côté client (250 ms typique).
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const { q, limit, country } = req.query;
      let results: CitySearchResult[] = [];
      try {
        results = await searchCities(q, { limit, countryCode: country });
      } catch (err) {
        req.log.error({ err, q }, "[cities.search] failed");
        return reply.code(500).send({
          success: false,
          error: { code: "SEARCH_FAILED", message: "Search failed, please retry" },
        });
      }
      return reply.send({ success: true, data: { results } });
    },
  );

  // --------------------------------------------------------
  // GET /cities/:geonameid — récupération unique
  // (utile pour valider/réhydrater une ville côté front)
  // --------------------------------------------------------
  fastify.get<{ Params: { geonameid: string } }>(
    "/:geonameid",
    {
      schema: {
        params: {
          type: "object",
          required: ["geonameid"],
          properties: { geonameid: { type: "string", pattern: "^\\d+$" } },
        },
        tags: ["cities"],
      },
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const id = parseInt(req.params.geonameid, 10);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_ID", message: "geonameid must be a number" },
        });
      }
      const city = await getCityById(id);
      if (!city) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "City not found" },
        });
      }
      return reply.send({ success: true, data: { city } });
    },
  );
};
