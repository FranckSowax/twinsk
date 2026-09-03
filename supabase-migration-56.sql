-- ================================================
-- Twinsk — Migration #56
-- Codes promo : remise sur le total des articles (hors transport) ou tarif
-- transport négocié (FCFA/kg aérien, FCFA/m³ maritime), avec fenêtre de
-- validité, quota global, quota par client, code personnel, et journal des
-- usages (réservé à l'application, confirmé au paiement, libéré si retiré).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS promo_codes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,            -- toujours en MAJUSCULES, sans espaces
  label              TEXT,                            -- libellé interne (ex. « Lancement — 100 premières commandes »)
  kind               TEXT NOT NULL CHECK (kind IN ('items_percent', 'items_fixed', 'air_rate', 'sea_rate')),
  value              NUMERIC NOT NULL CHECK (value >= 0),
  -- items_percent : % de remise sur le total articles · items_fixed : FCFA de remise
  -- air_rate : FCFA / kg appliqué au fret aérien · sea_rate : FCFA / m³ appliqué au maritime
  starts_at          TIMESTAMPTZ,                     -- NULL = immédiat
  ends_at            TIMESTAMPTZ,                     -- NULL = sans fin
  max_uses           INTEGER CHECK (max_uses IS NULL OR max_uses > 0),      -- NULL = illimité (ex. 100 = « 100 premières commandes »)
  max_uses_per_phone INTEGER NOT NULL DEFAULT 1 CHECK (max_uses_per_phone > 0),
  client_phone       TEXT,                            -- code PERSONNEL : chiffres seuls (ex. 24107425560)
  min_items_fcfa     NUMERIC CHECK (min_items_fcfa IS NULL OR min_items_fcfa >= 0),
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  notes              TEXT,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_codes_active_idx ON promo_codes (active, ends_at);

CREATE TABLE IF NOT EXISTS promo_uses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id       UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  order_id       UUID NOT NULL UNIQUE,                -- une seule promo par commande
  client_phone   TEXT,                                -- chiffres seuls
  discount_fcfa  NUMERIC NOT NULL DEFAULT 0,          -- remise articles obtenue (0 pour un tarif transport)
  status         TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'released')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS promo_uses_promo_idx ON promo_uses (promo_id, status);
CREATE INDEX IF NOT EXISTS promo_uses_phone_idx ON promo_uses (promo_id, client_phone) WHERE status <> 'released';

ALTER TABLE offer_orders
  ADD COLUMN IF NOT EXISTS promo_id            UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code          TEXT,
  ADD COLUMN IF NOT EXISTS promo_kind          TEXT,
  ADD COLUMN IF NOT EXISTS promo_discount_fcfa NUMERIC NOT NULL DEFAULT 0,   -- remise articles appliquée
  ADD COLUMN IF NOT EXISTS promo_rate          NUMERIC,                      -- tarif transport appliqué (FCFA/kg ou FCFA/m³)
  ADD COLUMN IF NOT EXISTS promo_attempts      INTEGER NOT NULL DEFAULT 0;   -- tentatives de code (anti brute-force)

COMMENT ON TABLE promo_codes IS 'Codes promo : remise articles (hors transport) ou tarif transport négocié, avec quotas et fenêtre.';
COMMENT ON TABLE promo_uses IS 'Usages : reserved à l''application sur la commande, confirmed au paiement, released si retiré/abandonné.';
COMMENT ON COLUMN offer_orders.promo_rate IS 'Tarif transport imposé par le code (FCFA/kg aérien ou FCFA/m³ maritime).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_orders DROP COLUMN IF EXISTS promo_id, DROP COLUMN IF EXISTS promo_code,
--   DROP COLUMN IF EXISTS promo_kind, DROP COLUMN IF EXISTS promo_discount_fcfa,
--   DROP COLUMN IF EXISTS promo_rate, DROP COLUMN IF EXISTS promo_attempts;
-- DROP TABLE IF EXISTS promo_uses;
-- DROP TABLE IF EXISTS promo_codes;
