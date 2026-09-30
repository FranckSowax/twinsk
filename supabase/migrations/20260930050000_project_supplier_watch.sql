-- ================================================
-- Projets › usines (30 sept. 2026) : points à surveiller par usine (entité
-- à confirmer, contact douteux, homonyme…), affichés à l'équipe seulement
-- dans « Usines & échanges ». Non destructive, idempotente.
-- ================================================
ALTER TABLE public.project_suppliers
  ADD COLUMN IF NOT EXISTS watch_points text[] NOT NULL DEFAULT '{}';
