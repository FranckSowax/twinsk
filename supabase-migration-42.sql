-- ================================================
-- Twinsk — Migration #42
-- Marqueur « Vu dans la vidéo » : produits présents dans la vidéo de cover de
-- l'offre. Coché dans /admin/offer → badge rose fluo sur /offer.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offer_products
  ADD COLUMN IF NOT EXISTS in_cover_video BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN offer_products.in_cover_video IS 'Produit présent dans la vidéo de cover — badge « Vu dans la vidéo » côté client.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_products DROP COLUMN IF EXISTS in_cover_video;
