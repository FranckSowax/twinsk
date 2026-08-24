-- ================================================
-- Twinsk — Migration #49
-- Archivage des offres (listings) : les offres publiées peuvent être envoyées
-- aux archives depuis /admin/offer-b2b et consultées en galerie sur /admin/archives.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS offers_archived_idx ON offers (archived_at DESC)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN offers.archived_at IS
  'Date d''archivage du listing (null = actif). Les offres archivées sortent des listes B2B/B2C et apparaissent dans la galerie /admin/archives.';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP INDEX IF EXISTS offers_archived_idx;
-- ALTER TABLE offers DROP COLUMN IF EXISTS archived_at;
