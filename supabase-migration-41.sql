-- ================================================
-- Twinsk — Migration #41
-- Vidéo mobile 1:1 (carrée) d'une offre : affichée en tête du lien public sur
-- SMARTPHONE uniquement, en autoplay + boucle. Distincte de la cover (image/vidéo).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS mobile_video_url TEXT;

COMMENT ON COLUMN offers.mobile_video_url IS 'Vidéo mp4 carrée (1:1) affichée en tête sur mobile (autoplay + boucle) quand l''offre est publiée.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offers DROP COLUMN IF EXISTS mobile_video_url;
