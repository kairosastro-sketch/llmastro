// ============================================================
// apps/api/src/scripts/import-cities.ts
// ------------------------------------------------------------
// Importe le dataset GeoNames cities500 dans la table `cities`.
//
// Usage :
//   pnpm --filter @astro-platform/api run import-cities
//
// Comportement :
//   1. Télécharge https://download.geonames.org/export/dump/cities500.zip
//      (~30 Mo zippé, ~80 Mo décompressé) dans /tmp/
//   2. Décompresse et parse le TSV (format documenté en haut du
//      fichier readme.txt de GeoNames)
//   3. Insère via COPY FROM STDIN (méthode rapide en bulk),
//      avec ON CONFLICT (geonameid) DO UPDATE pour permettre
//      les ré-imports (mises à jour mensuelles).
//
// Idempotent : peut être relancé sans risque.
// Volume : ~185 000 lignes, prend 30-60 secondes selon la machine.
// ============================================================

import { createWriteStream, createReadStream, existsSync, statSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:https";
import { Extract } from "unzipper";
import { from as copyFrom } from "pg-copy-streams";
import { pool } from "../db/index.js";

const GEONAMES_URL = "https://download.geonames.org/export/dump/cities500.zip";
const TMP_DIR      = tmpdir();
const ZIP_PATH     = join(TMP_DIR, "cities500.zip");
const TSV_PATH     = join(TMP_DIR, "cities500.txt");

// ─────────────────────────────────────────────────────────────
// Format du TSV GeoNames (19 colonnes, séparateur \t) :
//   0  geonameid       integer
//   1  name            varchar(200)
//   2  asciiname       varchar(200)
//   3  alternatenames  varchar(10000)
//   4  latitude        decimal
//   5  longitude       decimal
//   6  feature class   char(1)
//   7  feature code    varchar(10)
//   8  country code    char(2)
//   9  cc2             varchar(200)
//   10 admin1 code     varchar(20)
//   11 admin2 code     varchar(80)
//   12 admin3 code     varchar(20)
//   13 admin4 code     varchar(20)
//   14 population      bigint
//   15 elevation       integer
//   16 dem             integer
//   17 timezone        varchar(40)   ← IANA tz, ex. "Europe/Paris"
//   18 modification    date
// ─────────────────────────────────────────────────────────────

interface ParsedCity {
  geonameid:      number;
  name:           string;
  asciiName:      string;
  alternateNames: string;
  latitude:       number;
  longitude:      number;
  countryCode:    string;
  featureCode:    string;
  population:     number;
  ianaTz:         string;
}

function parseLine(line: string): ParsedCity | null {
  const f = line.split("\t");
  if (f.length < 19) return null;

  const geonameid = parseInt(f[0]!, 10);
  if (!Number.isFinite(geonameid)) return null;

  const lat = parseFloat(f[4]!);
  const lng = parseFloat(f[5]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const ianaTz = f[17]!.trim();
  if (!ianaTz || !ianaTz.includes("/")) return null;

  const countryCode = f[8]!.trim();
  if (countryCode.length !== 2) return null;

  return {
    geonameid,
    name:           (f[1] ?? "").slice(0, 200),
    asciiName:      (f[2] ?? "").slice(0, 200),
    alternateNames: (f[3] ?? "").slice(0, 10000),
    latitude:       lat,
    longitude:      lng,
    countryCode,
    featureCode:    (f[7] ?? "").slice(0, 10),
    population:     parseInt(f[14] ?? "0", 10) || 0,
    ianaTz:         ianaTz.slice(0, 64),
  };
}

// ─────────────────────────────────────────────────────────────
// Téléchargement
// ─────────────────────────────────────────────────────────────

async function downloadZip(): Promise<void> {
  if (existsSync(ZIP_PATH)) {
    const size = statSync(ZIP_PATH).size;
    if (size > 1_000_000) {
      console.log(`📦 Zip déjà présent (${(size / 1e6).toFixed(1)} Mo), skip download`);
      return;
    }
  }
  console.log(`⬇  Téléchargement ${GEONAMES_URL}...`);
  await new Promise<void>((resolve, reject) => {
    const req = request(GEONAMES_URL, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return reject(new Error(`Redirect non géré: ${res.headers.location}`));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const out = createWriteStream(ZIP_PATH);
      res.pipe(out);
      out.on("finish", () => resolve());
      out.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
  const sizeMb = (statSync(ZIP_PATH).size / 1e6).toFixed(1);
  console.log(`✅ Téléchargé (${sizeMb} Mo)`);
}

// ─────────────────────────────────────────────────────────────
// Décompression
// ─────────────────────────────────────────────────────────────

async function extractZip(): Promise<void> {
  console.log("📂 Décompression...");
  await pipeline(
    createReadStream(ZIP_PATH),
    Extract({ path: TMP_DIR }),
  );
  if (!existsSync(TSV_PATH)) {
    throw new Error(`Fichier TSV introuvable après extraction: ${TSV_PATH}`);
  }
  const sizeMb = (statSync(TSV_PATH).size / 1e6).toFixed(1);
  console.log(`✅ Extrait (${sizeMb} Mo)`);
}

// ─────────────────────────────────────────────────────────────
// Import en base via COPY FROM STDIN
// ─────────────────────────────────────────────────────────────
// Stratégie : on crée une table temporaire, on COPY dedans en
// bulk (très rapide), puis on UPSERT vers cities. Ça permet
// de gérer les conflits sans pénaliser la perf du COPY.
// ─────────────────────────────────────────────────────────────

async function importToPostgres(): Promise<{ inserted: number; updated: number }> {
  const client = await pool.connect();
  try {
    console.log("🔄 Création table temporaire...");
    await client.query(`
      CREATE TEMP TABLE cities_import (
        geonameid       INTEGER,
        name            VARCHAR(200),
        ascii_name      VARCHAR(200),
        alternate_names TEXT,
        latitude        DOUBLE PRECISION,
        longitude       DOUBLE PRECISION,
        country_code    CHAR(2),
        feature_code    VARCHAR(10),
        population      INTEGER,
        iana_tz         VARCHAR(64)
      ) ON COMMIT DROP;
    `);

    await client.query("BEGIN");

    console.log("📥 COPY en cours...");
    const copyStream = client.query(copyFrom(`
      COPY cities_import (
        geonameid, name, ascii_name, alternate_names,
        latitude, longitude, country_code, feature_code,
        population, iana_tz
      ) FROM STDIN WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\b')
    `));

    let lineCount = 0;
    let validCount = 0;
    const fileStream = createReadStream(TSV_PATH, { encoding: "utf8" });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      lineCount++;
      const c = parseLine(line);
      if (!c) continue;
      // Échappe \t dans les chaînes (peu probable mais sécurise le COPY)
      const safeName = c.name.replace(/\t/g, " ").replace(/\n/g, " ");
      const safeAscii = c.asciiName.replace(/\t/g, " ").replace(/\n/g, " ");
      const safeAlt = c.alternateNames.replace(/\t/g, " ").replace(/\n/g, " ");
      const row = [
        c.geonameid, safeName, safeAscii, safeAlt,
        c.latitude, c.longitude, c.countryCode, c.featureCode,
        c.population, c.ianaTz,
      ].join("\t") + "\n";
      copyStream.write(row);
      validCount++;
      if (validCount % 20000 === 0) {
        console.log(`  ${validCount.toLocaleString("fr")} lignes envoyées...`);
      }
    }

    copyStream.end();
    await new Promise<void>((resolve, reject) => {
      copyStream.on("finish", () => resolve());
      copyStream.on("error", reject);
    });

    console.log(`✅ ${validCount.toLocaleString("fr")} lignes importées (${lineCount - validCount} ignorées)`);

    console.log("🔀 Merge dans cities...");
    const mergeRes = await client.query<{ inserted: string; updated: string }>(`
      WITH upsert AS (
        INSERT INTO cities (
          geonameid, name, ascii_name, alternate_names,
          latitude, longitude, country_code, feature_code,
          population, iana_tz, source, updated_at
        )
        SELECT
          geonameid, name, ascii_name, alternate_names,
          latitude, longitude, country_code, feature_code,
          population, iana_tz, 'geonames', NOW()
        FROM cities_import
        ON CONFLICT (geonameid) DO UPDATE SET
          name            = EXCLUDED.name,
          ascii_name      = EXCLUDED.ascii_name,
          alternate_names = EXCLUDED.alternate_names,
          latitude        = EXCLUDED.latitude,
          longitude       = EXCLUDED.longitude,
          country_code    = EXCLUDED.country_code,
          feature_code    = EXCLUDED.feature_code,
          population      = EXCLUDED.population,
          iana_tz         = EXCLUDED.iana_tz,
          updated_at      = NOW()
        RETURNING (xmax = 0) AS is_insert
      )
      SELECT
        COUNT(*) FILTER (WHERE is_insert)::text  AS inserted,
        COUNT(*) FILTER (WHERE NOT is_insert)::text AS updated
      FROM upsert;
    `);

    await client.query("COMMIT");

    const inserted = parseInt(mergeRes.rows[0]?.inserted ?? "0", 10);
    const updated  = parseInt(mergeRes.rows[0]?.updated ?? "0", 10);
    return { inserted, updated };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const t0 = Date.now();
  try {
    await downloadZip();
    await extractZip();
    const { inserted, updated } = await importToPostgres();
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `\n🎉 Import terminé en ${dt}s\n` +
      `   ${inserted.toLocaleString("fr")} insérées\n` +
      `   ${updated.toLocaleString("fr")} mises à jour`,
    );

    // Cleanup
    try { await unlink(ZIP_PATH); } catch { /* ignore */ }
    try { await unlink(TSV_PATH); } catch { /* ignore */ }
  } catch (err) {
    console.error("❌ Import échoué:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
