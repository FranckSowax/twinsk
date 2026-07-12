-- ================================================
-- Twinsk — Migration #29
-- État de révision sur le produit d'offre : signale dans /admin/offer qu'un
-- collaborateur a révisé la ligne (fond bleu) tant que l'admin ne l'a pas validée.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

-- null = rien à signaler ; 'reviewed' = révisée par un collaborateur, en attente
-- de validation admin (ligne affichée en bleu dans /admin/offer).
ALTER TABLE offer_products
  ADD COLUMN IF NOT EXISTS review_state TEXT;

COMMENT ON COLUMN offer_products.review_state IS 'null | reviewed (révisée par collaborateur, en attente de validation admin → ligne bleue).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_products DROP COLUMN IF EXISTS review_state;
