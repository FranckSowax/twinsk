-- ================================================
-- Twinsk — Migration #26
-- Commandes /offer : snapshot produit (nom + image) + paiement (méthode + preuve).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

-- Snapshot du produit au moment de la commande (survit à la suppression du produit).
ALTER TABLE offer_order_lines
  ADD COLUMN IF NOT EXISTS product_title TEXT,
  ADD COLUMN IF NOT EXISTS product_image TEXT;

-- Paiement : méthode choisie + preuve (capture Airtel Money).
ALTER TABLE offer_orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT,      -- 'ebilling' | 'airtel'
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;   -- capture d'écran du virement Airtel

COMMENT ON COLUMN offer_order_lines.product_title IS 'Nom du produit au moment de la commande (snapshot).';
COMMENT ON COLUMN offer_order_lines.product_image IS 'Image du produit au moment de la commande (snapshot).';
COMMENT ON COLUMN offer_orders.payment_method IS 'Méthode de paiement : ebilling | airtel.';
COMMENT ON COLUMN offer_orders.payment_proof_url IS 'URL de la capture du virement Airtel Money (à vérifier par l''admin).';

-- payment_status : 'pending' (init) → 'submitted' (preuve Airtel envoyée) → 'paid' (validé admin).

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_order_lines DROP COLUMN IF EXISTS product_title, DROP COLUMN IF EXISTS product_image;
-- ALTER TABLE offer_orders DROP COLUMN IF EXISTS payment_method, DROP COLUMN IF EXISTS payment_proof_url;
