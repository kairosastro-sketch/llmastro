-- GENERIC-HOROSCOPES-V1
-- Horoscopes génériques (12 signes, sans personnalisation) destinés à la
-- syndication presse (quotidiens locaux) via l'API partenaire, plus les
-- clés API des partenaires.

CREATE TABLE IF NOT EXISTS generic_horoscopes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence       VARCHAR(10) NOT NULL,          -- 'day' | 'week'
  period_start  TIMESTAMP NOT NULL,
  sign_idx      INTEGER NOT NULL,              -- 0 = Bélier … 11 = Poissons
  text          TEXT NOT NULL,
  -- true si le texte a été retouché à la main dans l'admin : la
  -- régénération globale ne l'écrase pas.
  edited        BOOLEAN NOT NULL DEFAULT false,
  llm_model     VARCHAR(100),
  generated_at  TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT generic_horoscopes_period_sign_uq UNIQUE (cadence, period_start, sign_idx),
  CONSTRAINT generic_horoscopes_sign_idx_ck CHECK (sign_idx >= 0 AND sign_idx <= 11)
);

CREATE INDEX IF NOT EXISTS generic_horoscopes_lookup_idx
  ON generic_horoscopes (cadence, period_start);

CREATE TABLE IF NOT EXISTS partner_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,         -- nom du client (ex. journal)
  key_prefix    VARCHAR(12) NOT NULL,          -- préfixe affichable (identification)
  key_hash      VARCHAR(64) NOT NULL UNIQUE,   -- sha256 hex du token complet
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS partner_api_keys_hash_idx
  ON partner_api_keys (key_hash) WHERE active;
