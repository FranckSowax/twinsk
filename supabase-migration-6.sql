-- ================================================
-- Twinsk Sourcing System — Migration #6
-- Notes client + galerie d'images + traduction enrichie
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

-- Note laissée par le client pour un article (obligatoire si aucune sélection)
ALTER TABLE request_items
  ADD COLUMN IF NOT EXISTS client_note TEXT;

-- Galerie d'images supplémentaires + texte source pour retraduction
ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS extra_images JSONB,
  ADD COLUMN IF NOT EXISTS description_original TEXT;
