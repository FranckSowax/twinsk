-- ================================================
-- Projets › prix reçus (9 oct. 2026) : origine d'une offre et relecture.
-- Les prix trouvés par l'analyse d'un échange usine deviennent une offre
-- enregistrée tout de suite (onglet Comparaison), marquée « extraite
-- automatiquement » et invisible du client tant que l'équipe ne l'a pas
-- relue. Une offre saisie ou relue par l'équipe porte sa date de relecture.
-- Non destructive, idempotente.
-- ================================================
ALTER TABLE public.project_offers ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.project_offers ADD COLUMN IF NOT EXISTS checked_at timestamptz;
ALTER TABLE public.project_offers ADD COLUMN IF NOT EXISTS checked_by text;
-- Offres existantes : saisies à la main, donc déjà relues.
UPDATE public.project_offers SET checked_at = COALESCE(checked_at, updated_at) WHERE source = 'manual' AND checked_at IS NULL;
