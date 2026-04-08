-- ================================================
-- Twinsk Sourcing System — Migration #3
-- Permet les items texte-seul (sans image)
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

ALTER TABLE request_items
  ALTER COLUMN image_url DROP NOT NULL;
