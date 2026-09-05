-- ================================================
-- Twinsk — Migration #57
-- Best sellers d'un listing (B2B) : galerie horizontale de 12 produits max,
-- choisis par l'admin, affichée EN TÊTE de la page publique quand elle est
-- activée. Stockée sur l'offre : { enabled, product_ids[], title }.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS best_sellers JSONB NOT NULL
  DEFAULT '{"enabled": false, "product_ids": [], "title": null}'::jsonb;

COMMENT ON COLUMN offers.best_sellers IS
  'Galerie « Best sellers » : {enabled:boolean, product_ids:uuid[] (max 12, ordonnés), title:text|null}';
