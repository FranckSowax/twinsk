-- ================================================
-- Twinsk Sourcing System — Migration #7
-- Notes/conversations par produit (admin ↔ client)
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

CREATE TABLE IF NOT EXISTS item_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'admin',  -- 'admin' | 'client'
  message TEXT,
  media_urls JSONB,  -- array of image/video URLs
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_notes_request_item_id ON item_notes(request_item_id);

ALTER TABLE item_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Item notes are readable" ON item_notes FOR SELECT USING (true);
CREATE POLICY "Anyone can add item notes" ON item_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete item notes" ON item_notes FOR DELETE USING (true);
