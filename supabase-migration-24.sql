-- ================================================
-- Twinsk — Migration #24
-- Champs logistiques INTERNES (jamais exposés au client) :
--   • supplier_shipping_price : prix de livraison fournisseur → nos dépôts en Chine (CNY)
--   • delivery_time           : délai de livraison (texte libre, ex. "7-10 jours")
-- Visibles admin + collaborateur uniquement. À exécuter dans le SQL Editor. Idempotente.
-- ================================================

ALTER TABLE offer_products
  ADD COLUMN IF NOT EXISTS supplier_shipping_price NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_time TEXT;

ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS supplier_shipping_price NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_time TEXT;

COMMENT ON COLUMN offer_products.supplier_shipping_price IS
  'INTERNE — prix livraison fournisseur jusqu''à nos dépôts en Chine (CNY). Jamais exposé au client.';
COMMENT ON COLUMN offer_products.delivery_time IS
  'INTERNE — délai de livraison (texte). Jamais exposé au client.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_products  DROP COLUMN IF EXISTS supplier_shipping_price, DROP COLUMN IF EXISTS delivery_time;
-- ALTER TABLE search_results  DROP COLUMN IF EXISTS supplier_shipping_price, DROP COLUMN IF EXISTS delivery_time;
