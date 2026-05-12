// ============================================================
// apps/api/src/routes/notifications.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// 4 routes (toutes auth) :
//   GET    /notifications                    — liste paginée
//   PATCH  /notifications/:id/read           — mark as read
//   GET    /notifications/preferences        — read prefs (avec defaults)
//   PATCH  /notifications/preferences        — update prefs (PATCH partiel)
//
// Préfix dans index.ts : `/notifications`
// ============================================================

import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { notificationsService } from "../services/notifications.service.js";
import { userPreferencesService } from "../services/user-preferences.service.js";
import type { UserPreferences } from "../types/notification-payload.js";

export async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {

  // --------------------------------------------------------
  // GET /notifications  (?limit=20)
  // --------------------------------------------------------
  fastify.get<{ Querystring: { limit?: number } }>(
    "/",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["notifications"],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const { items, unreadCount } = await notificationsService.listForUser(
        ctx.userId,
        { limit: req.query.limit },
      );

      return reply.send({
        success: true,
        data: { items, unreadCount },
      });
    },
  );

  // --------------------------------------------------------
  // PATCH /notifications/:id/read
  // --------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    "/:id/read",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["notifications"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const updated = await notificationsService.markAsRead(req.params.id, ctx.userId);
      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOTIFICATION_NOT_FOUND", message: "Notification not found" },
        });
      }

      return reply.send({
        success: true,
        data: { id: updated.id, readAt: updated.readAt },
      });
    },
  );

  // --------------------------------------------------------
  // PATCH /notifications/mark-all-read
  // Marque toutes les notifs non lues du user comme lues.
  // Renvoie { updated: number } — peut être 0 si tout était déjà lu.
  // --------------------------------------------------------
  fastify.patch(
    "/mark-all-read",
    {
      preHandler: [authMiddleware],
      schema: { tags: ["notifications"] },
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const result = await notificationsService.markAllAsRead(ctx.userId);
      return reply.send({ success: true, data: result });
    },
  );

  // --------------------------------------------------------
  // DELETE /notifications/all
  // Hard-delete de toutes les notifs du user. Pas de soft-delete :
  // cap=10 → on n'archive pas un long historique de toute façon.
  // Renvoie { deleted: number } — peut être 0 si déjà vide.
  // --------------------------------------------------------
  fastify.delete(
    "/all",
    {
      preHandler: [authMiddleware],
      schema: { tags: ["notifications"] },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const result = await notificationsService.deleteAllForUser(ctx.userId);
      return reply.send({ success: true, data: result });
    },
  );

  // --------------------------------------------------------
  // GET /notifications/preferences
  // --------------------------------------------------------
  fastify.get(
    "/preferences",
    {
      preHandler: [authMiddleware],
      schema: { tags: ["notifications"] },
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const preferences = await userPreferencesService.get(ctx.userId);
      return reply.send({ success: true, data: { preferences } });
    },
  );

  // --------------------------------------------------------
  // PATCH /notifications/preferences
  // --------------------------------------------------------
  // Schema permissif : on accepte tous les champs UserPreferences
  // (validation stricte côté JSON Schema). Tout est optionnel ;
  // les champs absents = inchangés (PATCH partiel).
  fastify.patch<{ Body: UserPreferences }>(
    "/preferences",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["notifications"],
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            notify_events: {
              type: "object",
              additionalProperties: false,
              properties: {
                eclipses:  { type: "boolean" },
                lunations: { type: "boolean" },
                stations:  { type: "boolean" },
                ingresses: { type: "boolean" },
              },
            },
            notify_threshold:       { type: "string", enum: ["low", "medium", "high"] },
            notify_email_frequency: { type: "string", enum: ["never", "weekly", "instant"] },
            notify_email_critical:  { type: "boolean" },
            locale:                 { type: "string", enum: ["fr", "en"] },
          },
        },
      },
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const ctx = req.authContext;
      if (!ctx) {
        return reply.code(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const preferences = await userPreferencesService.update(ctx.userId, req.body);
      return reply.send({ success: true, data: { preferences } });
    },
  );
}

// NOTIFICATIONS-V1 routes applied
