-- ================================================
-- Twinsk Sourcing System — Migration #4
-- Suivi des items traités + ajouts post-soumission
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

ALTER TABLE request_items
  ADD COLUMN IF NOT EXISTS processed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS added_by TEXT NOT NULL DEFAULT 'client'; -- 'client' | 'admin'

-- Mark all existing items as processed (legacy data already had searches run)
UPDATE request_items SET processed = true WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_request_items_processed ON request_items(processed);
