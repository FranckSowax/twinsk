-- ================================================
-- Projets › questions (1er oct. 2026) : pièces jointes dans les réponses
-- (PDF, photos, vidéos), notamment quand le client répond aux questions de
-- l'équipe. Documents du bucket privé, au format Attachment. Non destructive.
-- ================================================
ALTER TABLE public.project_question_replies
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
