-- ================================================
-- Twinsk — Migration #11
-- Variantes produit (prix / dimensions / capacité / etc.)
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

-- Colonne JSONB pour stocker les variantes d'un produit (manuel).
-- Forme attendue:
-- [
--   {
--     "id":         "v1",           -- identifiant local
--     "name":       "Petit",        -- libellé variante (obligatoire)
--     "price":      12.5,           -- prix CNY (optionnel)
--     "moq":        100,            -- commande mini (optionnel)
--     "weight":     0.5,            -- poids kg (optionnel)
--     "volume":     0.001,          -- volume m³ (optionnel)
--     "dimensions": "20x10x5 cm",   -- texte libre (optionnel)
--     "capacity":   "500ml"         -- texte libre (optionnel)
--   },
--   ...
-- ]

ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS variants JSONB;

ALTER TABLE catalog
  ADD COLUMN IF NOT EXISTS variants JSONB;

COMMENT ON COLUMN search_results.variants IS
  'Variantes du produit (manuel): tableau JSONB de { name, price, moq, weight, volume, dimensions, capacity }';
COMMENT ON COLUMN catalog.variants IS
  'Variantes catalogue: tableau JSONB de { name, price, moq, weight, volume, dimensions, capacity }';
