-- ================================================
-- Projets › vidéo de couverture (30 sept. 2026) : une vidéo MP4 déposée par
-- l'équipe, affichée en tête de l'espace client, sous le titre. Fichier dans
-- le bucket privé project-files, servi par lien signé. Non destructive.
-- ================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_video_path text,
  ADD COLUMN IF NOT EXISTS cover_video_mime text,
  ADD COLUMN IF NOT EXISTS cover_video_size bigint,
  ADD COLUMN IF NOT EXISTS cover_video_updated_at timestamptz;
