-- ================================================
-- Twinsk Sourcing System — Migration #8
-- Catalogue centralisé de produits et usines
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

CREATE TABLE IF NOT EXISTS catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'taobao',
  external_id TEXT,
  title TEXT NOT NULL,
  title_original TEXT,
  description TEXT,
  description_original TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  main_image_url TEXT,
  extra_images JSONB,
  seller TEXT,
  product_url TEXT,
  moq INTEGER,
  weight NUMERIC(10,3),
  volume NUMERIC(10,4),
  dimensions TEXT,
  search_count INTEGER NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(source, external_id)
);

-- Enable pg_trgm extension BEFORE creating the index that uses it
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_catalog_source ON catalog(source);
CREATE INDEX IF NOT EXISTS idx_catalog_external_id ON catalog(external_id);
CREATE INDEX IF NOT EXISTS idx_catalog_search_count ON catalog(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_title_trgm ON catalog USING gin(title gin_trgm_ops);

-- Trigger updated_at (reuses existing function from migration #1)
CREATE TRIGGER trigger_catalog_updated_at
  BEFORE UPDATE ON catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Reference from search_results
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalog(id);

-- RLS
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalog is readable" ON catalog FOR SELECT USING (true);
CREATE POLICY "Catalog insert" ON catalog FOR INSERT WITH CHECK (true);
CREATE POLICY "Catalog update" ON catalog FOR UPDATE USING (true);
CREATE POLICY "Catalog delete" ON catalog FOR DELETE USING (true);
