-- ================================================
-- Twinsk — Migration #43
-- Paiement cash en agence : suivi de la relance (36h) pour ne l'envoyer qu'une fois.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offer_orders
  ADD COLUMN IF NOT EXISTS cash_reminded_at TIMESTAMPTZ;

COMMENT ON COLUMN offer_orders.cash_reminded_at IS 'Date d''envoi de la relance de paiement cash (36h). null = pas encore relancé.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_orders DROP COLUMN IF EXISTS cash_reminded_at;
