// ============================================================
// ADMIN-FOUNDATION-V1-BACKEND
// apps/api/src/routes/admin-panel.ts
// ------------------------------------------------------------
// Routes admin business (user-based, contrairement à /admin/*
// qui reste l'admin technique gardé par bearer token statique).
// Toutes les routes ci-dessous nécessitent un user JWT valide
// avec users.is_admin = true en DB (re-checké à chaque req).
// ============================================================

import type { FastifyPluginAsync } from "fastify";
import { requireAdminUser } from "../middleware/requireAdminUser.js";
import { pool } from "../db/index.js";

const adminPanelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", requireAdminUser);

  // ----------------------------------------------------------
  // GET /admin-panel/me — sanity ping pour vérifier que l'admin
  // peut accéder. Renvoie le user admin courant.
  // ----------------------------------------------------------
  fastify.get("/me", async (req, reply) => {
    const userId = req.authContext!.userId;
    const r = await pool.query(
      `SELECT id, email, name, is_admin FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (r.rowCount === 0) {
      return reply.code(404).send({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
    }
    return reply.send({
      success: true,
      data: {
        id:      r.rows[0].id,
        email:   r.rows[0].email,
        name:    r.rows[0].name,
        isAdmin: r.rows[0].is_admin === true,
      },
    });
  });

  // ----------------------------------------------------------
  // GET /admin-panel/users?q=&page=&limit=
  // ----------------------------------------------------------
  fastify.get<{
    Querystring: { q?: string; page?: string; limit?: string };
  }>(
    "/users",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q:     { type: "string", maxLength: 255 },
            page:  { type: "string" },
            limit: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const q     = (req.query.q ?? "").trim();
      const page  = Math.max(1, parseInt(req.query.page  ?? "1",  10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "20", 10) || 20));
      const offset = (page - 1) * limit;

      const params: unknown[] = [];
      let where = "";
      if (q.length > 0) {
        params.push(`%${q}%`);
        where = `WHERE u.email ILIKE $1 OR u.name ILIKE $1`;
      }

      const totalRes = await pool.query(
        `SELECT count(*)::int AS total FROM users u ${where}`,
        params
      );
      const total = totalRes.rows[0].total as number;

      const usersRes = await pool.query(
        `
        SELECT
          u.id, u.email, u.name, u.is_admin, u.created_at, u.deleted_at,
          p.code   AS plan_code,
          p.name   AS plan_name,
          us.status AS plan_status
        FROM users u
        LEFT JOIN user_subscriptions us ON us.user_id = u.id
        LEFT JOIN plans p              ON p.id        = us.plan_id
        ${where}
        ORDER BY u.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `,
        [...params, limit, offset]
      );

      return reply.send({
        success: true,
        data: {
          users: usersRes.rows,
          total,
          page,
          limit,
        },
      });
    }
  );

  // ----------------------------------------------------------
  // GET /admin-panel/users/:id
  // ----------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    "/users/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (req, reply) => {
      const r = await pool.query(
        `
        SELECT
          u.id, u.email, u.name, u.is_admin,
          u.email_verified, u.provider, u.timezone,
          u.created_at, u.updated_at, u.deleted_at,
          p.code               AS plan_code,
          p.name               AS plan_name,
          us.status            AS plan_status,
          us.current_period_end,
          us.started_at        AS plan_started_at,
          (SELECT MAX(created_at) FROM refresh_tokens WHERE user_id = u.id) AS last_token_at
        FROM users u
        LEFT JOIN user_subscriptions us ON us.user_id = u.id
        LEFT JOIN plans p              ON p.id        = us.plan_id
        WHERE u.id = $1
        LIMIT 1
        `,
        [req.params.id]
      );

      if (r.rowCount === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
      }
      return reply.send({ success: true, data: r.rows[0] });
    }
  );

  // ----------------------------------------------------------
  // POST /admin-panel/users/:id/plan
  // body: { plan_code: "free" | "essential" | "premium" }
  //
  // Note V1: pas d'invalidation de cache Redis. L'utilisateur
  // affecté verra le changement à son prochain /auth/me (cache
  // entitlements géré par entitlementsService).
  // ----------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body:   { plan_code: string };
  }>(
    "/users/:id/plan",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["plan_code"],
          properties: { plan_code: { type: "string", minLength: 1, maxLength: 32 } },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const userId   = req.params.id;
      const planCode = req.body.plan_code;

      // 1. User existe
      const userRes = await pool.query(
        `SELECT id FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      if (userRes.rowCount === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
      }

      // 2. Plan existe et actif
      const planRes = await pool.query(
        `SELECT id, code, name FROM plans WHERE code = $1 AND is_active = true LIMIT 1`,
        [planCode]
      );
      if (planRes.rowCount === 0) {
        return reply.code(400).send({
          success: false,
          error: {
            code:    "PLAN_NOT_FOUND",
            message: `Plan '${planCode}' not found or inactive`,
          },
        });
      }
      const planId = planRes.rows[0].id as string;

      // 3. UPSERT user_subscriptions (1 par user grâce au unique sur user_id)
      await pool.query(
        `
        INSERT INTO user_subscriptions (user_id, plan_id, status, started_at, updated_at)
        VALUES ($1, $2, 'active', now(), now())
        ON CONFLICT (user_id) DO UPDATE
          SET plan_id    = EXCLUDED.plan_id,
              status     = 'active',
              updated_at = now()
        `,
        [userId, planId]
      );

      return reply.send({
        success: true,
        data: {
          userId,
          plan: {
            code: planRes.rows[0].code,
            name: planRes.rows[0].name,
          },
        },
      });
    }
  );
};

export default adminPanelRoutes;

// ADMIN-FOUNDATION-V1-BACKEND applied
