-- ================================================
-- Twinsk — Migration #31
-- Devise d'affichage d'une offre côté client (lien public). Défaut : FCFA (XAF).
-- Les autres devises apparaissent en conversion (≈). Choisie dans /admin/offer.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS offer_currency TEXT NOT NULL DEFAULT 'XAF';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_offer_currency_check'
  ) THEN
    ALTER TABLE offers
      ADD CONSTRAINT offers_offer_currency_check
      CHECK (offer_currency IN ('CNY', 'USD', 'EUR', 'XAF'));
  END IF;
END $$;

COMMENT ON COLUMN offers.offer_currency IS 'Devise principale affichée au client sur le lien public (CNY|USD|EUR|XAF). Défaut XAF (FCFA).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_offer_currency_check;
-- ALTER TABLE offers DROP COLUMN IF EXISTS offer_currency;
