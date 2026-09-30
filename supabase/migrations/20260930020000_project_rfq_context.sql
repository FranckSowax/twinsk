-- ================================================
-- Projets › messages RFQ (30 sept. 2026) : contexte du programme (une phrase
-- EN/ZH + exigences communes) conservé sur le projet, pour recomposer les
-- messages d'un plan créé par l'IA (dont le modèle n'est pas persisté).
-- Non destructive, idempotente.
-- ================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rfq_context jsonb NOT NULL DEFAULT '{}'::jsonb;
