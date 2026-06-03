-- ================================================
-- Twinsk — Migration #17
-- Liens videos par produit (YouTube, MP4, etc.)
-- A executer dans le SQL Editor de Supabase Dashboard
-- ================================================

ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS videos JSONB;

ALTER TABLE offer_products
  ADD COLUMN IF NOT EXISTS videos JSONB;

-- Format attendu : tableau de strings (URLs)
-- ex: ["https://youtu.be/abc123", "https://cdn/xyz.mp4"]
