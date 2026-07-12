-- ================================================
-- Twinsk — Migration #28
-- Table « à réviser » : copie d'une ligne produit d'offre envoyée aux
-- collaborateurs pour qu'ils contactent le vendeur et complètent les infos
-- manquantes (poids, dimensions, prix fournisseur, délai…), puis la renvoient.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS collab_review_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Référence source (le produit peut être supprimé → on garde le snapshot)
  offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  offer_product_id UUID,          -- pas de FK : survit à la suppression du produit
  offer_title TEXT,

  -- Snapshot de la ligne (affichage)
  title TEXT,
  image_url TEXT,
  product_url TEXT,               -- URL 1688 pour contacter le vendeur
  seller TEXT,
  variants JSONB,

  -- Champs à compléter par le collaborateur
  price NUMERIC,
  weight NUMERIC(10,3),
  volume NUMERIC(10,4),
  dimensions TEXT,
  supplier_shipping_price NUMERIC,   -- prix livraison fournisseur → dépôt Chine
  delivery_time TEXT,                -- délai de livraison
  has_battery BOOLEAN,
  moq INTEGER,
  collab_notes TEXT,                 -- notes du collaborateur
  admin_note TEXT,                   -- consigne de l'admin (quoi demander au vendeur)

  -- Workflow de révision
  review_status TEXT NOT NULL DEFAULT 'pending',  -- pending | reviewed
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES collaborators(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ             -- quand l'admin a réappliqué les infos à l'offre
);

CREATE INDEX IF NOT EXISTS idx_collab_review_status ON collab_review_lines (review_status);
CREATE INDEX IF NOT EXISTS idx_collab_review_offer ON collab_review_lines (offer_id);

COMMENT ON TABLE collab_review_lines IS 'Lignes produit d''offre envoyées aux collaborateurs pour révision (compléter infos vendeur).';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP TABLE IF EXISTS collab_review_lines;
