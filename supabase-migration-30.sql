-- ================================================
-- Twinsk — Migration #30
-- Poids / volume / batterie sur les LIGNES de commande, pour que l'admin puisse
-- combler les trous (poids/volume manquants) et recalculer le total transport
-- directement depuis la commande, sans dépendre de la fiche produit.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offer_order_lines
  ADD COLUMN IF NOT EXISTS weight NUMERIC(10,3),   -- poids unitaire (kg)
  ADD COLUMN IF NOT EXISTS volume NUMERIC(10,4),   -- volume unitaire (m³)
  ADD COLUMN IF NOT EXISTS has_battery BOOLEAN;    -- contient une batterie

COMMENT ON COLUMN offer_order_lines.weight IS 'Poids unitaire (kg) — snapshot produit, éditable par l''admin.';
COMMENT ON COLUMN offer_order_lines.volume IS 'Volume unitaire (m³) — snapshot produit, éditable par l''admin.';
COMMENT ON COLUMN offer_order_lines.has_battery IS 'Contient une batterie — snapshot produit, éditable par l''admin.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_order_lines
--   DROP COLUMN IF EXISTS weight, DROP COLUMN IF EXISTS volume, DROP COLUMN IF EXISTS has_battery;
