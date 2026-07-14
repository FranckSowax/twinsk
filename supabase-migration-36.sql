-- ================================================
-- Twinsk — Migration #36
-- Type d'offre : B2C (défaut) ou B2B (offres dédiées aux professionnels).
-- Même moteur, mêmes fonctionnalités — deux onglets distincts dans l'admin.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS offer_type TEXT NOT NULL DEFAULT 'b2c';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_offer_type_check'
  ) THEN
    ALTER TABLE offers
      ADD CONSTRAINT offers_offer_type_check
      CHECK (offer_type IN ('b2c', 'b2b'));
  END IF;
END $$;

COMMENT ON COLUMN offers.offer_type IS 'b2c (défaut) | b2b — offres dédiées aux professionnels.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_offer_type_check;
-- ALTER TABLE offers DROP COLUMN IF EXISTS offer_type;
