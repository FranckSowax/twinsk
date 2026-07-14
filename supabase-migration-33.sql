-- ================================================
-- Twinsk — Migration #33
-- « Description admin » : description INTERNE (notes/specs pour l'équipe et les
-- collaborateurs), distincte de la description publique montrée au client.
-- Jamais exposée sur le lien public.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offer_products
  ADD COLUMN IF NOT EXISTS description_admin TEXT;

ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS description_admin TEXT;

COMMENT ON COLUMN offer_products.description_admin IS 'Description interne (admin/collaborateurs) — jamais montrée au client.';
COMMENT ON COLUMN search_results.description_admin IS 'Description interne (admin/collaborateurs) — jamais montrée au client.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_products DROP COLUMN IF EXISTS description_admin;
-- ALTER TABLE search_results DROP COLUMN IF EXISTS description_admin;
