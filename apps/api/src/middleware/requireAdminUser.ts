// ============================================================
// ADMIN-FOUNDATION-V1-BACKEND
// apps/api/src/middleware/requireAdminUser.ts
// ------------------------------------------------------------
// Middleware preHandler pour les routes /admin-panel/*.
// 1. Délègue à authMiddleware (vérif JWT + injection authContext)
// 2. RE-CHECK en DB le flag is_admin : on ne se fie jamais au JWT
//    seul. Un admin downgradé est viré instantanément même avec
//    un JWT vivant. Coût = 1 SELECT par requête, négligeable.
// ============================================================

import type { FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "./auth.middleware.js";
import { pool } from "../db/index.js";

export async function requireAdminUser(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 1. Auth (sets req.authContext)
  await authMiddleware(req, reply);
  if (reply.sent) return;

  const userId = req.authContext?.userId;
  if (!userId) {
    return reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  // 2. Re-check DB (jamais cache)
  const res = await pool.query(
    `SELECT is_admin FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  if (res.rowCount === 0 || res.rows[0]?.is_admin !== true) {
    return reply.code(403).send({
      success: false,
      error: { code: "ADMIN_REQUIRED", message: "Admin access required" },
    });
  }
}

// ADMIN-FOUNDATION-V1-BACKEND applied
