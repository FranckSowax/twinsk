-- ================================================
-- Twinsk Sourcing System — Migration #2
-- Ajoute support 1688 + traduction + colonnes enrichies
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'taobao',
  ADD COLUMN IF NOT EXISTS title_original TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS moq INTEGER,
  ADD COLUMN IF NOT EXISTS weight NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS volume NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS client_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS main_image_url TEXT;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'devis';

CREATE INDEX IF NOT EXISTS idx_search_results_source ON search_results(source);
