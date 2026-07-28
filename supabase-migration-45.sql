-- ================================================
-- Twinsk — Migration #45
-- Révisions : conserver le titre chinois d'origine (1688) sur la ligne à réviser,
-- pour l'afficher côté admin en chinois et sur la fiche vendeur. Idempotente.
-- ================================================

ALTER TABLE collab_review_lines
  ADD COLUMN IF NOT EXISTS title_original text;

COMMENT ON COLUMN collab_review_lines.title_original IS 'Titre original 1688 (chinois), copié depuis offer_products.title_original.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE collab_review_lines DROP COLUMN IF EXISTS title_original;
