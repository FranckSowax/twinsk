-- ================================================
-- Projets › prix reçus des usines (1er oct. 2026) : offres de prix par usine
-- (prix simple, variantes, paliers de quantité, options, frais fixes), marge
-- (% par défaut du projet, modifiable par offre, ou somme fixe par unité),
-- comparaison par lot. Le client ne voit que les offres cochées, au prix
-- retravaillé, sous alias ; jamais le prix usine ni la marge.
-- ================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_margin_pct numeric NOT NULL DEFAULT 25;

CREATE TABLE IF NOT EXISTS public.project_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.project_suppliers(id) ON DELETE CASCADE,
  lot text NOT NULL,
  exchange_id uuid REFERENCES public.project_supplier_exchanges(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'USD',
  incoterm text,
  port text,
  valid_until date,
  lead_time text,
  moq text,
  payment_terms text,
  notes text,
  -- [{id, kind: base|option|fee, label, variant: {clé: valeur}, unit, price, tiers: [{min_qty, price}], per: unit|order, quote_line_id}]
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  margin_mode text NOT NULL DEFAULT 'pct' CHECK (margin_mode IN ('pct', 'amount')),
  -- null en mode % = marge par défaut du projet ; en mode « amount », somme par unité dans la devise du projet.
  margin_value numeric,
  client_visible boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  supersedes uuid REFERENCES public.project_offers(id) ON DELETE SET NULL,
  raw text,
  client_interested_at timestamptz,
  client_interested_by text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_offers_project_idx ON public.project_offers (project_id, lot, status);
ALTER TABLE public.project_offers ENABLE ROW LEVEL SECURITY;
