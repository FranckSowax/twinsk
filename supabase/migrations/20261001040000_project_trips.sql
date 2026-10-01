-- ================================================
-- Voyages d'audit planifiés depuis les commandes (1er oct. 2026).
--
-- Remplace l'itinéraire figé du modèle : l'onglet « Rapport & voyage » part
-- vierge ; l'équipe crée un voyage, y ajoute les usines des commandes (une
-- étape par usine) et le propose au client quand il est prêt.
-- stops : [{id, day, date, city, supplier_id, order_ids[], line_ids[], program, internal_note}]
-- Accès serveur uniquement (service_role) : RLS active sans politique.
-- Non destructive, idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS public.project_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'confirmed', 'done')),
  stops jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_note text,
  interested_at timestamptz,
  interested_by text,
  quote_requested_at timestamptz,
  quote_requested_by text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_trips_project_idx ON public.project_trips (project_id, start_date NULLS LAST, created_at);

ALTER TABLE public.project_trips ENABLE ROW LEVEL SECURITY;
