-- ================================================
-- Historique des marges et des prix (29 sept. 2026, demande de Franck).
--
-- Chaque changement de marge (%) ou de prix d'un produit — de listing
-- (offer_products, B2B / B2C / sur devis) ou de demande sur devis
-- (search_results) — est consigné : ancienne et nouvelle valeur, auteur, date.
-- Un changement appliqué à tout un listing (« Marge globale → Appliquer à
-- tous ») partage un même batch_id : c'est aussi la « marge enregistrée » que
-- l'admin retrouve à la réouverture.
--
-- Accès : routes serveur (service_role) uniquement ; RLS active sans politique.
-- Idempotente.
-- ================================================
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'offer' : listing (offer_products) ; 'request' : demande sur devis (search_results).
  scope text NOT NULL CHECK (scope IN ('offer', 'request')),
  -- Id du listing ou de la demande.
  target_id uuid NOT NULL,
  product_id uuid,
  product_title text,
  -- 'margin_percent' | 'price' | 'variant_price'
  field text NOT NULL,
  variant_name text,
  old_value numeric,
  new_value numeric,
  -- Changement groupé (même opération sur plusieurs produits) : même batch_id.
  batch_id uuid,
  batch_size integer,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_history_target_idx ON public.price_history (scope, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS price_history_product_idx ON public.price_history (product_id, created_at DESC);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
