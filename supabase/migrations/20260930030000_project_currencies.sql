-- ================================================
-- Projets › devises (30 sept. 2026) : les prix des usines arrivent en yuans
-- ou en dollars. Chaque montant du devis garde sa devise de saisie ; le projet
-- a une devise principale (projects.currency, dollar par défaut) et une table
-- de taux « 1 devise = X devise principale » (projects.rates), modifiable.
-- Les lignes existantes sont réputées saisies dans la devise du projet.
-- Non destructive, idempotente.
-- ================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rates jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.project_quote_lines
  ADD COLUMN IF NOT EXISTS price_currency text,
  ADD COLUMN IF NOT EXISTS cost_currency text;

UPDATE public.project_quote_lines l
SET price_currency = p.currency
FROM public.projects p
WHERE p.id = l.project_id AND l.price_currency IS NULL;

UPDATE public.project_quote_lines l
SET cost_currency = p.currency
FROM public.projects p
WHERE p.id = l.project_id AND l.cost_currency IS NULL;
