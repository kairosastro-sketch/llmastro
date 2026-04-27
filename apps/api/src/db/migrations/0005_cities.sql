-- ============================================================
-- migrations/0005_cities.sql
-- ------------------------------------------------------------
-- Table de référence des villes du monde (GeoNames cities500).
-- Remplace les 4 listes hardcodées éparpillées dans le code :
--   • packages/ephemeris/src/astro-engine.ts (CITIES legacy)
--   • packages/ephemeris/src/cities.ts (68 villes)
--   • apps/web/src/lib/cities.ts (37 villes)
--   • apps/web/src/components/natal/NatalForm.tsx (37 villes)
--
-- Source : https://download.geonames.org/export/dump/cities500.zip
-- ~185 000 villes ≥ 500 hab. ou chefs-lieux administratifs.
-- Licence : CC BY 4.0
-- ============================================================

-- pg_trgm pour la recherche fuzzy (typo-tolérante) en autocomplete.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS cities (
  -- geonameid : id stable de GeoNames, sert de clé primaire pour
  -- les imports incrémentaux et la déduplication.
  geonameid     INTEGER PRIMARY KEY,

  -- Nom UTF-8 dans la langue locale (ex. "Genève", "東京")
  name          VARCHAR(200) NOT NULL,
  -- Translittération ASCII (ex. "Geneve", "Tokyo")
  ascii_name    VARCHAR(200) NOT NULL,
  -- Synonymes séparés par virgules (ex. "Geneve,Genf,Ginevra,...")
  -- Permet de matcher "London" → "Londres", "Pekin" → "Beijing", etc.
  alternate_names TEXT NOT NULL DEFAULT '',

  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,

  -- Code ISO-3166 alpha-2 (ex. "FR", "US", "JP")
  country_code  CHAR(2) NOT NULL,

  -- Feature code GeoNames : PPL=ville, PPLC=capitale, PPLA=chef-lieu admin1,
  -- PPLA2..PPLA5=chef-lieu admin2..5, PPLX=quartier, etc.
  -- Voir http://www.geonames.org/export/codes.html
  feature_code  VARCHAR(10) NOT NULL,

  -- Population (0 si inconnue) — sert au scoring de pertinence
  -- en autocomplete (Paris > Paris, Texas).
  population    INTEGER NOT NULL DEFAULT 0,

  -- Timezone IANA (ex. "Europe/Paris", "Pacific/Tahiti")
  -- Toujours fournie par GeoNames, c'est ce qui rend cette base
  -- supérieure à tout autre dataset pour notre cas astrologique.
  iana_tz       VARCHAR(64) NOT NULL,

  -- "geonames" pour les imports natifs, "manual" pour les ajouts admin,
  -- "mapbox" prévu pour un futur fallback de géocodage (option B).
  source        VARCHAR(20) NOT NULL DEFAULT 'geonames',

  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- Index pour la recherche
-- ─────────────────────────────────────────────────────────────

-- GIN trigram sur name + ascii_name pour recherche fuzzy.
-- gin_trgm_ops accepte les opérateurs % (similarity) et ILIKE.
CREATE INDEX IF NOT EXISTS idx_cities_name_trgm
  ON cities USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cities_ascii_trgm
  ON cities USING GIN (ascii_name gin_trgm_ops);

-- Index sur les noms alternatifs pour matcher "London"/"Londres".
CREATE INDEX IF NOT EXISTS idx_cities_alt_trgm
  ON cities USING GIN (alternate_names gin_trgm_ops);

-- BTREE sur population pour le tri descendant rapide.
CREATE INDEX IF NOT EXISTS idx_cities_population
  ON cities (population DESC);

-- BTREE sur country_code pour les filtres "ville en France uniquement".
CREATE INDEX IF NOT EXISTS idx_cities_country
  ON cities (country_code);

-- ─────────────────────────────────────────────────────────────
-- Note sur la stratégie d'import
-- ─────────────────────────────────────────────────────────────
-- Le peuplement de cette table se fait via le script
--   apps/api/src/scripts/import-cities.ts
-- qui télécharge cities500.zip, parse le TSV et fait un COPY
-- en bulk. À lancer une fois après la migration, puis
-- périodiquement (mensuel) pour récupérer les mises à jour
-- GeoNames.
-- ─────────────────────────────────────────────────────────────
