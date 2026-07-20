-- ================================================
-- Twinsk — Migration #38
-- Phases d'offre (B2B) : une phase regroupe plusieurs catégories (offer_items),
-- chacune contenant ses produits. Ex : « Phase 1 — Rénovation », « Phase 2 —
-- Aménagement »… Une catégorie sans phase reste possible (phase_id null).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS offer_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_offer_phases_offer ON offer_phases(offer_id, position);

-- Rattachement d'une catégorie à une phase (null = sans phase).
ALTER TABLE offer_items
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES offer_phases(id) ON DELETE SET NULL;

COMMENT ON TABLE offer_phases IS 'Phases d''une offre (B2B) regroupant des catégories (offer_items).';
COMMENT ON COLUMN offer_items.phase_id IS 'Phase de la catégorie (null = sans phase).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_items DROP COLUMN IF EXISTS phase_id;
-- DROP TABLE IF EXISTS offer_phases;
