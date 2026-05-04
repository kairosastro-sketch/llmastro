// ============================================================
// ADMIN-FOUNDATION-V1-BACKEND
// apps/api/src/boot/init-admin-flag.ts
// ------------------------------------------------------------
// 1. Ajoute la colonne users.is_admin si absente (idempotent)
// 2. Sync depuis env ADMIN_EMAILS (CSV) en mode strict :
//    - liste vide  → SKIP (pas de wipe accidentel)
//    - liste non-vide → seuls ces emails sont admin (les autres
//      perdent leur flag)
// ============================================================

import { pool } from "../db/index.js";

export async function initAdminFlag(): Promise<void> {
  // 1. Migration idempotente
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false
  `);

  // 2. Lecture env ADMIN_EMAILS (CSV)
  const raw = process.env["ADMIN_EMAILS"] ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[init-admin-flag] ADMIN_EMAILS is empty — skipping sync (no admin will be designated)"
    );
    return;
  }

  // 3. Sync strict
  await pool.query(
    `UPDATE users SET is_admin = (LOWER(email) = ANY($1::text[]))`,
    [emails]
  );

  // 4. Diagnostic
  const adminsRes = await pool.query(
    `SELECT email FROM users WHERE is_admin = true ORDER BY email`
  );
  const foundAdmins: string[] = adminsRes.rows.map(
    (r: { email: string }) => r.email
  );
  const missed = emails.filter(
    (e) => !foundAdmins.some((f) => f.toLowerCase() === e)
  );

  // eslint-disable-next-line no-console
  console.log(
    `[init-admin-flag] strict sync OK — ${foundAdmins.length} admin(s): [${foundAdmins.join(", ")}]`
  );
  if (missed.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[init-admin-flag] ADMIN_EMAILS contained ${missed.length} email(s) not present in users table: [${missed.join(", ")}]`
    );
  }
}

// ADMIN-FOUNDATION-V1-BACKEND applied
