// ENCRYPT-NATAL-V1 — boot task idempotent : bascule natal_data vers le
// chiffrement applicatif au repos (AES-256-GCM, cf. db/crypto.ts + schema.ts).
//
// Trois étapes, rejouables sans effet de bord :
//   1. CANARI — détecte une DATA_ENCRYPTION_KEY erronée AVANT de toucher aux
//      données : si la clé ne déchiffre pas le canari déjà stocké, on refuse de
//      démarrer (sinon on lirait/écrirait du charabia).
//   2. ALTER — élargit les colonnes chiffrées en `text` (le ciphertext base64
//      ne tient pas dans les varchar(n) d'origine ; latitude/longitude passent
//      de double precision à text).
//   3. BACKFILL — chiffre les lignes existantes encore en clair (skip les
//      valeurs déjà préfixées `v1:`).
//
// DOIT tourner APRÈS toutes les migrations qui créent ces colonnes
// (runMigrations, init-schema-coherence pour gender/relationship_status,
// init-relationships pour relationship_category/type). Voir index.ts.

import { pool } from "../db/index.js";
import { encryptValue, decryptValue, isEncrypted } from "../db/crypto.js";

// Colonnes (noms DB) chiffrées. latitude/longitude incluses : stockées en text,
// rendues en number côté app par le customType encryptedFloat.
const ENCRYPTED_COLUMNS = [
  "label",
  "birth_date",
  "birth_time",
  "latitude",
  "longitude",
  "timezone",
  "birth_city",
  "birth_country",
  "gender",
  "relationship_status",
  "relationship_category",
  "relationship_type",
] as const;

const CANARY_PLAINTEXT = "llmastro-natal-canary-v1";

const WIDEN_SQL = `
  -- Élargit chaque colonne chiffrée en text si ce n'est pas déjà le cas.
  -- Idempotent : ne réécrit la table que lors du tout premier passage.
  DO $$
  DECLARE c text;
  BEGIN
    FOREACH c IN ARRAY ARRAY[
      'label','birth_date','birth_time','latitude','longitude','timezone',
      'birth_city','birth_country','gender','relationship_status',
      'relationship_category','relationship_type'
    ]
    LOOP
      IF (SELECT data_type FROM information_schema.columns
            WHERE table_name = 'natal_data' AND column_name = c) <> 'text' THEN
        EXECUTE format('ALTER TABLE natal_data ALTER COLUMN %I TYPE text USING %I::text', c, c);
      END IF;
    END LOOP;
  END $$;
`;

export async function initNatalEncryption(): Promise<void> {
  const client = await pool.connect();
  try {
    // ── 1. CANARI — valide la clé avant toute écriture ──────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS crypto_canary (
        id    integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        token text NOT NULL
      );
    `);
    const { rows: canaryRows } = await client.query<{ token: string }>(
      "SELECT token FROM crypto_canary WHERE id = 1",
    );
    if (canaryRows.length === 0) {
      // Premier boot avec chiffrement : on scelle le canari avec la clé courante.
      await client.query("INSERT INTO crypto_canary (id, token) VALUES (1, $1)", [
        encryptValue(CANARY_PLAINTEXT),
      ]);
    } else {
      let ok = false;
      try {
        ok = decryptValue(canaryRows[0]!.token) === CANARY_PLAINTEXT;
      } catch {
        ok = false;
      }
      if (!ok) {
        // eslint-disable-next-line no-console
        console.error(
          "❌ FATAL [init-natal-encryption] DATA_ENCRYPTION_KEY ne déchiffre pas " +
            "le canari : clé erronée ou changée. Démarrage refusé pour ne pas " +
            "corrompre natal_data. Restaurer la bonne clé.",
        );
        process.exit(1);
      }
    }

    // ── 2. ALTER — élargit les colonnes en text ─────────────────────────────
    await client.query(WIDEN_SQL);

    // ── 3. BACKFILL — chiffre les lignes encore en clair ────────────────────
    const cols = ENCRYPTED_COLUMNS.join(", ");
    const { rows } = await client.query<Record<string, string | null>>(
      `SELECT id, ${cols} FROM natal_data`,
    );
    let updated = 0;
    for (const row of rows) {
      const sets: string[] = [];
      const vals: string[] = [];
      let i = 1;
      for (const col of ENCRYPTED_COLUMNS) {
        const v = row[col];
        if (v != null && !isEncrypted(v)) {
          sets.push(`${col} = $${i++}`);
          vals.push(encryptValue(String(v)));
        }
      }
      if (sets.length > 0) {
        vals.push(row["id"] as string);
        await client.query(`UPDATE natal_data SET ${sets.join(", ")} WHERE id = $${i}`, vals);
        updated++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `✅ [init-natal-encryption] colonnes chiffrées prêtes (${rows.length} profils, ${updated} backfillés)`,
    );
  } finally {
    client.release();
  }
}
