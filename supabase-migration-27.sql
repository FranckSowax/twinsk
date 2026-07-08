-- ================================================
-- Twinsk — Migration #27
-- Statut de traitement de la commande (dropdown admin) + snapshot de l'URL 1688
-- du produit sur chaque ligne (pour le bouton « Payer » côté admin).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

-- Statut de traitement : unpaid (non payé) → paid (payée) → shipped (expédié) → delivered (livrée).
-- Distinct de payment_status (vérification du paiement client) et de status (workflow interne).
ALTER TABLE offer_orders
  ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'unpaid';

-- URL 1688 (ou autre marketplace) du produit, figée à la commande — sert au bouton
-- « Payer » qui renvoie l'admin vers la fiche fournisseur pour régler l'achat.
ALTER TABLE offer_order_lines
  ADD COLUMN IF NOT EXISTS product_url TEXT;

COMMENT ON COLUMN offer_orders.order_status IS 'Statut de traitement : unpaid | paid | shipped | delivered.';
COMMENT ON COLUMN offer_order_lines.product_url IS 'URL marketplace (1688…) du produit au moment de la commande (snapshot).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_orders DROP COLUMN IF EXISTS order_status;
-- ALTER TABLE offer_order_lines DROP COLUMN IF EXISTS product_url;
