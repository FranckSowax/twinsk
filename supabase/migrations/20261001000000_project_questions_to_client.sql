-- ================================================
-- Projets (1er oct. 2026) : questions posées PAR l'équipe AU client (souvent
-- extraites d'un échange avec une usine), et analyse IA d'un échange
-- (réponse proposée EN/FR, explication, questions de l'usine).
-- Le lien vers l'usine et l'échange reste interne (jamais exposé au client).
-- Non destructive, idempotente.
-- ================================================
ALTER TABLE public.project_questions
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'from_client' CHECK (direction IN ('from_client', 'to_client')),
  ADD COLUMN IF NOT EXISTS lot text,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.project_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exchange_id uuid REFERENCES public.project_supplier_exchanges(id) ON DELETE SET NULL;

ALTER TABLE public.project_supplier_exchanges
  ADD COLUMN IF NOT EXISTS analysis jsonb;
