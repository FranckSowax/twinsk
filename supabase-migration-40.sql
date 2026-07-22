-- ================================================
-- Twinsk — Migration #40
-- Ordre manuel des produits dans une catégorie (glisser-déposer).
-- Avant tout réordonnancement (position NULL), les produits restent triés par
-- fiabilité fournisseur (trust). Dès qu'on réordonne, position pilote l'ordre.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offer_products
  ADD COLUMN IF NOT EXISTS position INTEGER;

CREATE INDEX IF NOT EXISTS idx_offer_products_item_pos ON offer_products (offer_item_id, position);

COMMENT ON COLUMN offer_products.position IS 'Ordre manuel dans la catégorie (null = non ordonné → tri par fiabilité).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_products DROP COLUMN IF EXISTS position;
