-- ================================================
-- Twinsk — Migration #39
-- Autorise l'upload de vidéos mp4 dans le bucket Storage « request-images » :
--   - ajoute video/mp4 aux types MIME autorisés (en gardant les images)
--   - relève la limite de taille à 50 Mo (couvre les covers vidéo)
-- À exécuter dans le SQL Editor de Supabase (rôle service). Idempotente.
-- ================================================

UPDATE storage.buckets
SET
  file_size_limit = 52428800,  -- 50 Mo (= 50 * 1024 * 1024)
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4'
  ]
WHERE id = 'request-images';

-- Vérification (optionnelle) :
-- SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'request-images';

-- ================================================
-- ROLLBACK (revenir aux images seules, 10 Mo)
-- ================================================
-- UPDATE storage.buckets
-- SET file_size_limit = 10485760,
--     allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
-- WHERE id = 'request-images';
