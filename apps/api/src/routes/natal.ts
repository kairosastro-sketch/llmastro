import type { FastifyPluginAsync } from "fastify";
import type { JWTPayload, NatalDataCreate } from "@astro-platform/types";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { natalService } from "../services/natal.service.js";

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
