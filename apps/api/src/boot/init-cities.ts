// ============================================================
// apps/api/src/boot/init-cities.ts
// ------------------------------------------------------------
// Helper de boot : applique la migration SQL 0005 (cities) si
// la table n'existe pas. Pattern miroir des init-readings.ts /
// seed-plans.ts.
//
// Le peuplement effectif de la table se fait séparément via
// `pnpm tsx apps/api/src/scripts/import-cities.ts` (script de
// maintenance, pas exécuté au boot pour ne pas bloquer le
// démarrage avec un téléchargement de 30 Mo).
// ============================================================

import { pool } from "../db/index.js";

const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS cities (
  geonameid       INTEGER PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  ascii_name      VARCHAR(200) NOT NULL,
  alternate_names TEXT NOT NULL DEFAULT '',
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  country_code    CHAR(2) NOT NULL,
  feature_code    VARCHAR(10) NOT NULL,
  population      INTEGER NOT NULL DEFAULT 0,
  iana_tz         VARCHAR(64) NOT NULL,
  source          VARCHAR(20) NOT NULL DEFAULT 'geonames',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cities_name_trgm
  ON cities USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cities_ascii_trgm
  ON cities USING GIN (ascii_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cities_alt_trgm
  ON cities USING GIN (alternate_names gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cities_population
  ON cities (population DESC);

CREATE INDEX IF NOT EXISTS idx_cities_country
  ON cities (country_code);
`;

export async function initCities(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    const { rows } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM cities",
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);
    if (count === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "⚠ Table `cities` est vide. Lancer le script d'import :\n" +
        "    pnpm --filter @astro-platform/api run import-cities\n" +
        "  (ou `tsx apps/api/src/scripts/import-cities.ts`)",
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`✅ Cities table ready (${count.toLocaleString("fr")} entries)`);
    }
  } finally {
    client.release();
  }
}
