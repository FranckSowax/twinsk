-- ================================================
-- Twinsk — Migration #25
-- Débloque la suppression d'une offre / catégorie / produit déjà commandé.
--
-- Problème : offer_order_lines.product_id → offer_products.id était en RESTRICT,
-- donc supprimer un produit commandé (directement ou par cascade depuis une
-- catégorie/offre) échouait :
--   "update or delete on table offer_products violates foreign key constraint
--    offer_order_lines_product_id_fkey on table offer_order_lines"
--
-- Correctif : ON DELETE SET NULL. La ligne de commande conserve son snapshot
-- financier (unit_price_cny, quantity, subtotal_cny, variant_name) ; seul le lien
-- vers le produit supprimé est mis à NULL. Le code d'affichage/transport gère déjà
-- un product_id null (poids/volume → null, montants préservés).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

-- Autoriser NULL (requis pour ON DELETE SET NULL).
ALTER TABLE offer_order_lines ALTER COLUMN product_id DROP NOT NULL;

-- Recréer la contrainte en ON DELETE SET NULL.
ALTER TABLE offer_order_lines DROP CONSTRAINT IF EXISTS offer_order_lines_product_id_fkey;
ALTER TABLE offer_order_lines
  ADD CONSTRAINT offer_order_lines_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES offer_products(id) ON DELETE SET NULL;

-- ================================================
-- ROLLBACK (revenir au blocage RESTRICT)
-- ================================================
-- ALTER TABLE offer_order_lines DROP CONSTRAINT IF EXISTS offer_order_lines_product_id_fkey;
-- ALTER TABLE offer_order_lines
--   ADD CONSTRAINT offer_order_lines_product_id_fkey
--   FOREIGN KEY (product_id) REFERENCES offer_products(id);
