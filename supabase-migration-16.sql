-- ================================================
-- Twinsk — Migration #16
-- Champ destination (ville/pays de livraison du client)
-- A executer dans le SQL Editor de Supabase Dashboard
-- ================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS destination TEXT;

COMMENT ON COLUMN requests.destination IS
  'Ville/pays de livraison du client (texte libre, ex: "Libreville, Gabon")';
