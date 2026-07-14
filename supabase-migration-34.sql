-- ================================================
-- Twinsk — Migration #34
-- Horodatage de la réponse du vendeur sur la fiche partagée (lien public /fiche/[id]).
-- Permet au collaborateur de savoir que le vendeur a rempli poids/volume/délai…
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE collab_review_lines
  ADD COLUMN IF NOT EXISTS vendor_filled_at TIMESTAMPTZ;

COMMENT ON COLUMN collab_review_lines.vendor_filled_at IS 'Date à laquelle le vendeur a rempli la fiche partagée (lien public).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE collab_review_lines DROP COLUMN IF EXISTS vendor_filled_at;
