-- ================================================
-- Projets › usines (30 sept. 2026) : photos des produits reçues de l'usine,
-- montrées au client dans la fiche anonymisée (onglet « Usines »).
-- [{doc_id, caption}] ; les fichiers sont des documents internes du bucket
-- privé, servis au client seulement s'ils figurent dans cette liste.
-- ================================================
ALTER TABLE public.project_suppliers
  ADD COLUMN IF NOT EXISTS product_photos jsonb NOT NULL DEFAULT '[]'::jsonb;
