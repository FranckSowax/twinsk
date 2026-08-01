-- ================================================
-- Twinsk — Migration #46
-- Catalogue v3.1 : price_type / price_note (produit). price_type = "acompte" →
-- le prix n'est PAS un prix de vente (montant d'acompte usine, sur devis).
-- Les variantes portent ces champs dans le jsonb `variants` (pas de colonne).
-- Idempotente. À exécuter dans le SQL Editor.
-- ================================================

ALTER TABLE offer_products
  ADD COLUMN IF NOT EXISTS price_type text,
  ADD COLUMN IF NOT EXISTS price_note text;

COMMENT ON COLUMN offer_products.price_type IS 'Type de prix : "acompte" = acompte usine (pas un prix de vente). null/absent = prix unitaire normal.';
COMMENT ON COLUMN offer_products.price_note IS 'Note libre sur le prix (ex. conditions d''acompte), affichée en infobulle.';

-- Snapshot sur la ligne de commande : une ligne "acompte" est une demande de devis
-- (exclue du total vendable). null = ligne normale.
ALTER TABLE offer_order_lines
  ADD COLUMN IF NOT EXISTS price_type text;

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_products DROP COLUMN IF EXISTS price_type, DROP COLUMN IF EXISTS price_note;
