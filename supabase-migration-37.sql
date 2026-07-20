-- ================================================
-- Twinsk — Migration #37
-- Cover vidéo (mp4) d'une offre — remplace/complète l'image de cover.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS cover_video_url TEXT;

COMMENT ON COLUMN offers.cover_video_url IS 'URL d''une vidéo mp4 de cover (prioritaire sur cover_image_url à l''affichage).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offers DROP COLUMN IF EXISTS cover_video_url;
