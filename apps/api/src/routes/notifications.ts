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

import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { db } from "../db/index.js";
import { pushSubscriptions } from "../db/schema.js";
import { notificationsService } from "../services/notifications.service.js";
import { userPreferencesService } from "../services/user-preferences.service.js";
import { isPushConfigured } from "../services/push-dispatch.service.js";
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
            notify_push:            { type: "boolean" },
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

  // ============================================================
  // WEB-PUSH-V1 — subscriptions Web Push API
  // ============================================================

  // --------------------------------------------------------
  // GET /notifications/push/config
  // Renvoie la clé publique VAPID et le statut configuré.
  // Le frontend peut aussi lire NEXT_PUBLIC_VAPID_PUBLIC_KEY au
  // build, mais cet endpoint est utile pour valider côté runtime
  // que l'API est bien configurée avant de proposer l'opt-in à
  // l'utilisateur (évite un subscribe qui échoue silencieusement
  // si l'admin a oublié de set VAPID_PRIVATE_KEY en prod).
  // --------------------------------------------------------
  fastify.get(
    "/push/config",
    {
      preHandler: [authMiddleware],
      schema: { tags: ["notifications"] },
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (_req, reply) => {
      const configured = isPushConfigured();
      const publicKey  = process.env["VAPID_PUBLIC_KEY"]?.trim() ?? "";
      return reply.send({
        success: true,
        data: {
          configured,
          publicKey: configured ? publicKey : "",
        },
      });
    },
  );

  // --------------------------------------------------------
  // POST /notifications/push/subscribe
  // Body = PushSubscriptionJSON renvoyé par PushManager.subscribe().toJSON()
  //   { endpoint, keys: { p256dh, auth } }
  // UPSERT par endpoint (on garde un row unique par device, indépendant
  // de l'user qui était logué la 1ère fois — au re-login on rattache
  // l'endpoint au nouvel user_id).
  // --------------------------------------------------------
  fastify.post<{
    Body: {
      endpoint: string;
      keys:     { p256dh: string; auth: string };
    };
  }>(
    "/push/subscribe",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["notifications"],
        body: {
          type: "object",
          required: ["endpoint", "keys"],
          additionalProperties: false,
          properties: {
            endpoint: { type: "string", minLength: 16, maxLength: 2048 },
            keys: {
              type: "object",
              required: ["p256dh", "auth"],
              additionalProperties: false,
              properties: {
                p256dh: { type: "string", minLength: 16, maxLength: 256 },
                auth:   { type: "string", minLength: 8,  maxLength: 64  },
              },
            },
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

      // Garde-fou : on n'accepte que les push services connus / sains.
      // En pratique le navigateur ne retourne jamais d'autre chose, mais
      // ça évite qu'un endpoint forgé arrive en DB et qu'on tente d'y
      // envoyer du trafic.
      if (!/^https:\/\//.test(req.body.endpoint)) {
        return reply.code(400).send({
          success: false,
          error: { code: "INVALID_ENDPOINT", message: "Endpoint must be https://" },
        });
      }

      const userAgent = req.headers["user-agent"]?.slice(0, 512) ?? null;

      await db
        .insert(pushSubscriptions)
        .values({
          userId:    ctx.userId,
          endpoint:  req.body.endpoint,
          p256dh:    req.body.keys.p256dh,
          auth:      req.body.keys.auth,
          userAgent,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId:     ctx.userId,
            p256dh:     req.body.keys.p256dh,
            auth:       req.body.keys.auth,
            userAgent,
            lastSeenAt: new Date(),
          },
        });

      return reply.send({ success: true, data: { ok: true } });
    },
  );

  // --------------------------------------------------------
  // DELETE /notifications/push/subscribe
  // Body = { endpoint } — supprime la subscription de ce device.
  // Symmétrique avec POST /push/subscribe. L'user click sur "désactiver
  // push" → on POST DELETE avec son endpoint courant, puis on appelle
  // PushSubscription.unsubscribe() côté navigateur.
  // --------------------------------------------------------
  fastify.delete<{ Body: { endpoint: string } }>(
    "/push/subscribe",
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ["notifications"],
        body: {
          type: "object",
          required: ["endpoint"],
          additionalProperties: false,
          properties: {
            endpoint: { type: "string", minLength: 16, maxLength: 2048 },
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

      // SECURITY : la WHERE clause doit AND sur user_id pour qu'un user
      // ne puisse pas supprimer la subscription d'un autre user juste en
      // connaissant son endpoint (endpoint UNIQUE en DB, donc une simple
      // DELETE WHERE endpoint=X serait cross-tenant).
      const deleted = await db
        .delete(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.endpoint, req.body.endpoint),
          eq(pushSubscriptions.userId,   ctx.userId),
        ))
        .returning({ id: pushSubscriptions.id });

      if (deleted.length === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found" },
        });
      }

      return reply.send({ success: true, data: { ok: true } });
    },
  );
}

// NOTIFICATIONS-V1 routes applied
// WEB-PUSH-V1 routes applied
