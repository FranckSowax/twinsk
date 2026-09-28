-- ================================================
-- Produits « maritime uniquement » (28 sept. 2026, demande de Franck) :
-- vernis, gels, primers, dissolvants, colles… sont des liquides dangereux
-- (inflammables) interdits en fret aérien.
--
-- Un produit marqué : mention « Livraison maritime uniquement » sur sa fiche,
-- jamais en avion (commande entière en bateau, ou fractionnement où il part
-- en bateau). Même logique que les articles de plus de 1,5 m³.
--
-- Colonne neutre par défaut (false) : aucun produit existant ne change tant
-- qu'il n'est pas marqué dans l'admin. Idempotente.
-- ================================================
ALTER TABLE public.offer_products
  ADD COLUMN IF NOT EXISTS sea_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.offer_products.sea_only IS
  'Interdit en fret aérien (liquide dangereux : vernis, gel, dissolvant…) : livraison maritime uniquement.';
