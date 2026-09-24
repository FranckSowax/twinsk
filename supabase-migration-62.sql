-- ================================================
-- Twinsk — Migration #62 — Multi-pays (Oh My Gab / Oh My Cot)
--  1. Franc CFA d'Afrique de l'Ouest (XOF, Côte d'Ivoire) autorisé comme devise
--     d'un listing et d'une proposition (décision D4). XAF reste la valeur par
--     défaut ; le projet CI la remplace par XOF dans son seed (CI.sql).
--  2. Table de référence `delivery_zones` : villes / zones desservies, délais,
--     tarifs de fret et agence de retrait par pays. Données dans
--     supabase/seed/reference/<pays>.sql. Sans effet sur l'application tant
--     qu'elle lit encore ces valeurs dans src/config/countries.ts.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

-- 1. XOF
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_offer_currency_check;
ALTER TABLE offers ADD CONSTRAINT offers_offer_currency_check
  CHECK (offer_currency IN ('CNY', 'USD', 'EUR', 'XAF', 'XOF'));

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_proposal_currency_check;
ALTER TABLE requests ADD CONSTRAINT requests_proposal_currency_check
  CHECK (proposal_currency IN ('CNY', 'USD', 'EUR', 'XAF', 'XOF'));

-- 2. Zones de livraison
CREATE TABLE IF NOT EXISTS delivery_zones (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     TEXT UNIQUE NOT NULL,          -- ex. 'libreville', 'abidjan-cocody'
  label                    TEXT NOT NULL,                 -- libellé affiché
  city                     TEXT NOT NULL,
  hub_code                 TEXT,                          -- 'LBV', 'ABJ'
  is_default               BOOLEAN NOT NULL DEFAULT false,
  home_delivery            BOOLEAN NOT NULL DEFAULT false,
  delivery_fee             INTEGER NOT NULL DEFAULT 0,    -- frais de livraison locale, devise du pays
  pickup_agency            TEXT,                          -- agence de retrait
  transit_air_min_days     INTEGER,
  transit_air_max_days     INTEGER,
  transit_sea_min_days     INTEGER,
  transit_sea_max_days     INTEGER,
  air_rate_per_kg          INTEGER,
  air_battery_rate_per_kg  INTEGER,
  sea_rate_per_m3          INTEGER,
  sea_rate_floor_per_m3    INTEGER,
  active                   BOOLEAN NOT NULL DEFAULT true,
  position                 INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_zones_one_default_idx ON delivery_zones (is_default) WHERE is_default;
-- Même régime que les autres tables : accès par la clé service uniquement.
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
