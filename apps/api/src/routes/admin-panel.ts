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
import { promoCodesService, PromoCodeError, type PromoKind } from "../services/promo-codes.service.js";

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

  // ─────────────────────────────────────────────────────────
  // ADMIN-STATS-V1-BACKEND — routes stats
  // ─────────────────────────────────────────────────────────

  // GET /admin-panel/stats/overview
  fastify.get("/stats/overview", async (_req, reply) => {
    const totals = await pool.query(
      `SELECT
         count(*) FILTER (WHERE u.deleted_at IS NULL)::int                                                  AS active_users,
         count(*) FILTER (WHERE u.deleted_at IS NOT NULL)::int                                              AS deleted_users,
         count(*) FILTER (WHERE u.created_at >= now() - interval '7 days'  AND u.deleted_at IS NULL)::int   AS signups_7d,
         count(*) FILTER (WHERE u.created_at >= now() - interval '30 days' AND u.deleted_at IS NULL)::int   AS signups_30d,
         count(*) FILTER (WHERE u.is_admin = true AND u.deleted_at IS NULL)::int                            AS admin_users
       FROM users u`
    );

    const byPlan = await pool.query(
      `SELECT p.code, p.name, count(us.user_id)::int AS users_count
       FROM plans p
       LEFT JOIN user_subscriptions us ON us.plan_id = p.id
       LEFT JOIN users u ON u.id = us.user_id AND u.deleted_at IS NULL
       WHERE p.is_active = true
       GROUP BY p.code, p.name, p.sort_order
       ORDER BY p.sort_order`
    );

    return reply.send({
      success: true,
      data: { totals: totals.rows[0], byPlan: byPlan.rows },
    });
  });

  // GET /admin-panel/stats/connections?days=7
  fastify.get<{ Querystring: { days?: string } }>(
    "/stats/connections",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { days: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const days = Math.min(90, Math.max(1, parseInt(req.query.days ?? "7", 10) || 7));

      const r = await pool.query(
        `SELECT
           DATE(created_at) AS date,
           count(*) FILTER (WHERE kind = 'login'    AND success = true)::int  AS logins,
           count(*) FILTER (WHERE kind = 'login'    AND success = false)::int AS logins_failed,
           count(*) FILTER (WHERE kind = 'register' AND success = true)::int  AS registers
         FROM login_events
         WHERE created_at >= now() - ($1 || ' days')::interval
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`,
        [String(days)]
      );

      return reply.send({
        success: true,
        data: { days, events: r.rows },
      });
    }
  );

  // GET /admin-panel/stats/xai?days=7
  fastify.get<{ Querystring: { days?: string } }>(
    "/stats/xai",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { days: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const days = Math.min(90, Math.max(1, parseInt(req.query.days ?? "7", 10) || 7));

      const daily = await pool.query(
        `SELECT
           DATE(created_at)                          AS date,
           count(*)::int                             AS total_calls,
           count(*) FILTER (WHERE success)::int      AS success_count,
           coalesce(sum(tokens_in)::int,  0)         AS total_tokens_in,
           coalesce(sum(tokens_out)::int, 0)         AS total_tokens_out,
           coalesce(round(avg(latency_ms))::int, 0)  AS avg_latency_ms
         FROM xai_calls_log
         WHERE created_at >= now() - ($1 || ' days')::interval
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`,
        [String(days)]
      );

      const total = await pool.query(
        `SELECT
           count(*)::int                             AS total_calls,
           count(*) FILTER (WHERE success)::int      AS success_count,
           coalesce(sum(tokens_in)::int,  0)         AS total_tokens_in,
           coalesce(sum(tokens_out)::int, 0)         AS total_tokens_out,
           coalesce(round(avg(latency_ms))::int, 0)  AS avg_latency_ms
         FROM xai_calls_log
         WHERE created_at >= now() - ($1 || ' days')::interval`,
        [String(days)]
      );

      return reply.send({
        success: true,
        data: { days, total: total.rows[0], daily: daily.rows },
      });
    }
  );
  // ─────────────────────────────────────────────────────────
  // GROWTH-V1-ADMIN — affiliate management
  // Liste / détail / update tier+override+status / attache user.
  // Snapshot strict des conditions (spec A-05) : modifications du
  // tier ou des overrides n'affectent QUE les futures attributions.
  // Toute modification écrit une ligne affiliate_terms_history.
  // ─────────────────────────────────────────────────────────

  // ----------------------------------------------------------
  // GET /admin-panel/affiliates?q=&status=&page=&limit=
  // ----------------------------------------------------------
  fastify.get<{
    Querystring: { q?: string; status?: string; page?: string; limit?: string };
  }>(
    "/affiliates",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q:      { type: "string", maxLength: 255 },
            status: { type: "string", enum: ["pending", "active", "paused", "banned", "all"] },
            page:   { type: "string" },
            limit:  { type: "string" },
          },
          additionalProperties: false,
        },
      },
      // CodeQL "Missing rate limiting" : on documente la limite en plus
      // du rate-limit global (100/min). Les routes admin sont déjà
      // protégées par requireAdminUser (re-check DB à chaque req),
      // donc 30/min/IP est largement suffisant pour les flux admin réels.
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const q      = (req.query.q ?? "").trim();
      const status = req.query.status ?? "all";
      const page   = Math.max(1, parseInt(req.query.page  ?? "1",  10) || 1);
      const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "20", 10) || 20));
      const offset = (page - 1) * limit;

      const params: unknown[] = [];
      const conditions: string[] = [];

      if (status !== "all") {
        params.push(status);
        conditions.push(`a.status = $${params.length}`);
      }
      if (q.length > 0) {
        params.push(`%${q}%`);
        conditions.push(`(a.display_name ILIKE $${params.length} OR a.slug ILIKE $${params.length})`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const totalRes = await pool.query(
        `SELECT count(*)::int AS total FROM affiliates a ${where}`,
        params,
      );
      const total = totalRes.rows[0].total as number;

      const rows = await pool.query(
        `
        SELECT
          a.id, a.slug, a.display_name, a.status, a.tier,
          a.commission_pct_override, a.commission_months_override,
          a.user_id, a.created_at, a.updated_at,
          (SELECT count(*)::int FROM affiliate_attributions
            WHERE affiliate_id = a.id AND expires_at > now())          AS active_attributions,
          (SELECT count(*)::int FROM affiliate_clicks
            WHERE affiliate_id = a.id)                                  AS lifetime_clicks
        FROM affiliates a
        ${where}
        ORDER BY a.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `,
        [...params, limit, offset],
      );

      return reply.send({
        success: true,
        data: { affiliates: rows.rows, total, page, limit },
      });
    },
  );

  // ----------------------------------------------------------
  // GET /admin-panel/affiliates/:id
  // ----------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    "/affiliates/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
      // CodeQL : route admin (requireAdminUser), 30/min/IP largement suffisant.
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const r = await pool.query(
        `
        SELECT
          a.id, a.slug, a.display_name, a.status, a.tier,
          a.commission_pct_override, a.commission_months_override,
          a.user_id, a.legal_name, a.siret, a.notes,
          a.created_at, a.updated_at,
          u.email AS user_email
        FROM affiliates a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.id = $1
        LIMIT 1
        `,
        [req.params.id],
      );
      if (r.rowCount === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: "AFFILIATE_NOT_FOUND", message: "Affiliate not found" },
        });
      }

      // Décode notes JSON si c'est une candidature (kind: "application")
      let application: unknown = null;
      let freeformNotes: string | null = null;
      if (r.rows[0].notes) {
        try {
          const parsed = JSON.parse(r.rows[0].notes);
          if (parsed && typeof parsed === "object" && parsed.kind === "application") {
            application = parsed;
          } else {
            freeformNotes = r.rows[0].notes;
          }
        } catch {
          freeformNotes = r.rows[0].notes;
        }
      }

      const history = await pool.query(
        `
        SELECT
          h.id, h.previous_tier, h.previous_pct, h.previous_months,
          h.new_tier, h.new_pct, h.new_months, h.reason, h.changed_at,
          ub.email AS changed_by_email
        FROM affiliate_terms_history h
        LEFT JOIN users ub ON ub.id = h.changed_by
        WHERE h.affiliate_id = $1
        ORDER BY h.changed_at DESC
        LIMIT 50
        `,
        [req.params.id],
      );

      const stats = await pool.query(
        `
        SELECT
          (SELECT count(*)::int FROM affiliate_clicks WHERE affiliate_id = $1)                              AS lifetime_clicks,
          (SELECT count(*)::int FROM affiliate_attributions WHERE affiliate_id = $1)                        AS lifetime_signups,
          (SELECT count(*)::int FROM affiliate_attributions WHERE affiliate_id = $1 AND expires_at > now()) AS active_attributions
        `,
        [req.params.id],
      );

      const { notes: _omit, ...affiliateNoNotes } = r.rows[0];

      return reply.send({
        success: true,
        data: {
          affiliate:    affiliateNoNotes,
          application,
          notes:        freeformNotes,
          history:      history.rows,
          stats:        stats.rows[0],
        },
      });
    },
  );

  // ----------------------------------------------------------
  // PATCH /admin-panel/affiliates/:id
  // body : { tier?, commission_pct_override?, commission_months_override?,
  //          status?, reason? }
  //
  // Toute modification de tier/override est append au audit log
  // (affiliate_terms_history). reason est optionnel mais recommandé.
  // Le snapshot strict (spec A-05) garantit que les anciennes
  // attributions ne sont jamais re-évaluées.
  // ----------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: {
      tier?:                       string;
      commission_pct_override?:    number | null;
      commission_months_override?: number | null;
      status?:                     string;
      reason?:                     string;
    };
  }>(
    "/affiliates/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            tier:   { type: "string", enum: ["standard", "vip", "top", "partner"] },
            status: { type: "string", enum: ["pending", "active", "paused", "banned"] },
            commission_pct_override:    { type: ["number", "null"], minimum: 5, maximum: 50 },
            commission_months_override: { type: ["number", "null"], minimum: 1, maximum: 36 },
            reason: { type: "string", maxLength: 500 },
          },
          additionalProperties: false,
        },
      },
      // CodeQL : write admin (requireAdminUser), 20/min/IP — plus serré que
      // les reads, suffisant pour un workflow d'édition manuelle.
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const adminId = req.authContext!.userId;

      const before = await pool.query(
        `SELECT tier, commission_pct_override, commission_months_override, status
         FROM affiliates WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      if (before.rowCount === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: "AFFILIATE_NOT_FOUND", message: "Affiliate not found" },
        });
      }
      const prev = before.rows[0];

      const updates: string[] = [];
      const values:  unknown[] = [];
      const auditChanged = {
        previous_tier:    prev.tier,
        previous_pct:     prev.commission_pct_override,
        previous_months:  prev.commission_months_override,
        new_tier:         prev.tier,
        new_pct:          prev.commission_pct_override,
        new_months:       prev.commission_months_override,
      };
      let conditionsChanged = false;

      if (typeof req.body.tier === "string" && req.body.tier !== prev.tier) {
        values.push(req.body.tier);
        updates.push(`tier = $${values.length}`);
        auditChanged.new_tier = req.body.tier;
        conditionsChanged = true;
      }
      if (req.body.commission_pct_override !== undefined &&
          req.body.commission_pct_override !== prev.commission_pct_override) {
        values.push(req.body.commission_pct_override);
        updates.push(`commission_pct_override = $${values.length}`);
        auditChanged.new_pct = req.body.commission_pct_override;
        conditionsChanged = true;
      }
      if (req.body.commission_months_override !== undefined &&
          req.body.commission_months_override !== prev.commission_months_override) {
        values.push(req.body.commission_months_override);
        updates.push(`commission_months_override = $${values.length}`);
        auditChanged.new_months = req.body.commission_months_override;
        conditionsChanged = true;
      }
      if (typeof req.body.status === "string" && req.body.status !== prev.status) {
        values.push(req.body.status);
        updates.push(`status = $${values.length}`);
      }

      if (updates.length === 0) {
        return reply.code(400).send({
          success: false,
          error: { code: "NO_CHANGES", message: "Nothing to update" },
        });
      }

      updates.push(`updated_at = now()`);
      values.push(req.params.id);

      const updated = await pool.query(
        `UPDATE affiliates SET ${updates.join(", ")}
         WHERE id = $${values.length}
         RETURNING id, slug, display_name, status, tier,
                   commission_pct_override, commission_months_override,
                   user_id, updated_at`,
        values,
      );

      if (conditionsChanged) {
        await pool.query(
          `
          INSERT INTO affiliate_terms_history
            (affiliate_id, changed_by, previous_tier, previous_pct, previous_months,
             new_tier, new_pct, new_months, reason)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            req.params.id, adminId,
            auditChanged.previous_tier, auditChanged.previous_pct, auditChanged.previous_months,
            auditChanged.new_tier, auditChanged.new_pct, auditChanged.new_months,
            req.body.reason ?? null,
          ],
        );
      }

      return reply.send({ success: true, data: updated.rows[0] });
    },
  );

  // ----------------------------------------------------------
  // POST /admin-panel/affiliates/:id/attach-user
  // body : { email }
  //
  // Attache un user existant à l'affilié (link manuel via email).
  // Refuse si email inconnu ou déjà attaché à un autre affilié.
  // ----------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body:   { email: string };
  }>(
    "/affiliates/:id/attach-user",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email", maxLength: 255 } },
          additionalProperties: false,
        },
      },
      // CodeQL : write admin (requireAdminUser), 10/min/IP — opération
      // d'attache rarement répétée, marge confortable contre le brute-force.
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const normalizedEmail = req.body.email.toLowerCase().trim();

      const userRes = await pool.query(
        `SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [normalizedEmail],
      );
      if (userRes.rowCount === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "No user with that email" },
        });
      }
      const userId = userRes.rows[0].id as string;

      const conflict = await pool.query(
        `SELECT id, slug FROM affiliates WHERE user_id = $1 AND id <> $2 LIMIT 1`,
        [userId, req.params.id],
      );
      if ((conflict.rowCount ?? 0) > 0) {
        return reply.code(409).send({
          success: false,
          error: {
            code:    "USER_ALREADY_AFFILIATE",
            message: `User already attached to affiliate ${conflict.rows[0].slug}`,
          },
        });
      }

      const updated = await pool.query(
        `UPDATE affiliates SET user_id = $1, updated_at = now()
         WHERE id = $2
         RETURNING id, slug, user_id`,
        [userId, req.params.id],
      );
      if (updated.rowCount === 0) {
        return reply.code(404).send({
          success: false,
          error: { code: "AFFILIATE_NOT_FOUND", message: "Affiliate not found" },
        });
      }

      return reply.send({
        success: true,
        data: { affiliate: updated.rows[0], user: { id: userId, email: userRes.rows[0].email } },
      });
    },
  );
  // ─────────────────────────────────────────────────────────
  // PROMO-CODES-V1 — admin CRUD pour /admin/promos
  // ─────────────────────────────────────────────────────────

  fastify.get<{
    Querystring: { q?: string; active?: string; page?: string; limit?: string };
  }>(
    "/promo-codes",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q:      { type: "string", maxLength: 64 },
            active: { type: "string", enum: ["true", "false", "all"] },
            page:   { type: "string" },
            limit:  { type: "string" },
          },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const page  = Math.max(1, parseInt(req.query.page  ?? "1",  10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "20", 10) || 20));
      const activeParam = req.query.active ?? "all";
      const activeFilter =
        activeParam === "true"  ? true  :
        activeParam === "false" ? false :
        undefined;

      const result = await promoCodesService.listPromos({
        q:      req.query.q,
        active: activeFilter,
        page,
        limit,
      });
      return reply.send({ success: true, data: result });
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/promo-codes/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const promo = await promoCodesService.getPromoById(req.params.id);
      if (!promo) {
        return reply.code(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Promo code not found" },
        });
      }
      const redemptions = await promoCodesService.listRedemptions(req.params.id);
      return reply.send({ success: true, data: { promo, redemptions } });
    },
  );

  fastify.post<{
    Body: {
      code:                  string;
      description?:          string | null;
      kind:                  PromoKind;
      subscriptionPlanCode?: string | null;
      subscriptionDays?:     number | null;
      featureKey?:           string | null;
      creditQuantity?:       number | null;
      maxRedemptions?:       number | null;
      maxPerUser?:           number;
      validFrom?:            string | null;
      expiresAt?:            string | null;
    };
  }>(
    "/promo-codes",
    {
      schema: {
        body: {
          type: "object",
          required: ["code", "kind"],
          properties: {
            code:                 { type: "string", minLength: 3, maxLength: 40 },
            description:          { type: ["string", "null"], maxLength: 500 },
            kind:                 { type: "string", enum: ["subscription_days", "feature_credits"] },
            subscriptionPlanCode: { type: ["string", "null"], maxLength: 32 },
            subscriptionDays:     { type: ["number", "null"], minimum: 1, maximum: 365 },
            featureKey:           { type: ["string", "null"], maxLength: 64 },
            creditQuantity:       { type: ["number", "null"], minimum: 1, maximum: 10000 },
            maxRedemptions:       { type: ["number", "null"], minimum: 1 },
            maxPerUser:           { type: "number", minimum: 1, maximum: 100 },
            validFrom:            { type: ["string", "null"], format: "date-time" },
            expiresAt:            { type: ["string", "null"], format: "date-time" },
          },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const adminId = req.authContext!.userId;
      try {
        const promo = await promoCodesService.createPromo({
          ...req.body,
          validFrom: req.body.validFrom ? new Date(req.body.validFrom) : null,
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
          createdBy: adminId,
        });
        return reply.code(201).send({ success: true, data: promo });
      } catch (err) {
        if (err instanceof PromoCodeError) {
          return reply.code(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: {
      description?:    string | null;
      active?:         boolean;
      maxRedemptions?: number | null;
      expiresAt?:      string | null;
    };
  }>(
    "/promo-codes/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            description:    { type: ["string", "null"], maxLength: 500 },
            active:         { type: "boolean" },
            maxRedemptions: { type: ["number", "null"], minimum: 1 },
            expiresAt:      { type: ["string", "null"], format: "date-time" },
          },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      try {
        const patch: Parameters<typeof promoCodesService.updatePromo>[1] = {};
        if (req.body.description    !== undefined) patch.description    = req.body.description;
        if (req.body.active         !== undefined) patch.active         = req.body.active;
        if (req.body.maxRedemptions !== undefined) patch.maxRedemptions = req.body.maxRedemptions;
        if (req.body.expiresAt      !== undefined) patch.expiresAt      = req.body.expiresAt ? new Date(req.body.expiresAt) : null;

        const promo = await promoCodesService.updatePromo(req.params.id, patch);
        return reply.send({ success: true, data: promo });
      } catch (err) {
        if (err instanceof PromoCodeError) {
          return reply.code(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/promo-codes/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      try {
        const promo = await promoCodesService.archivePromo(req.params.id);
        return reply.send({ success: true, data: promo });
      } catch (err) {
        if (err instanceof PromoCodeError) {
          return reply.code(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  // PROMO-CODES-V1 admin routes applied
};

export default adminPanelRoutes;

// ADMIN-FOUNDATION-V1-BACKEND applied

// ADMIN-STATS-V1-BACKEND applied

// ADMIN-STATS-V1-FIX-V1 applied

// GROWTH-V1-ADMIN applied

// PROMO-CODES-V1 applied
