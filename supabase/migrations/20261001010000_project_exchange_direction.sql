-- ================================================
-- Projets › échanges usines (1er oct. 2026) : sens de l'échange, pour le fil
-- de chaque fiche usine — out = message envoyé à l'usine, in = réponse reçue
-- de l'usine, note = compte rendu interne. Non destructive, idempotente.
-- ================================================
ALTER TABLE public.project_supplier_exchanges
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'note' CHECK (direction IN ('out', 'in', 'note'));

-- Reprise de l'existant : envois générés par la plateforme → out ; échanges analysés → in.
UPDATE public.project_supplier_exchanges SET direction = 'out'
WHERE direction = 'note' AND (summary LIKE 'E-mail envoyé depuis %' OR summary LIKE '% hors plateforme.%');

UPDATE public.project_supplier_exchanges SET direction = 'in'
WHERE direction = 'note' AND analysis IS NOT NULL;
