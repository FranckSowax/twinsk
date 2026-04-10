-- ================================================
-- Twinsk — Migration #9
-- Index supplémentaires pour recherche rapide dans le catalogue
-- ================================================

-- Trigram index on title_original (Chinese text search)
CREATE INDEX IF NOT EXISTS idx_catalog_title_original_trgm ON catalog USING gin(title_original gin_trgm_ops);

-- Trigram index on seller
CREATE INDEX IF NOT EXISTS idx_catalog_seller_trgm ON catalog USING gin(seller gin_trgm_ops);

-- Trigram index on description
CREATE INDEX IF NOT EXISTS idx_catalog_description_trgm ON catalog USING gin(description gin_trgm_ops);

-- Price range queries
CREATE INDEX IF NOT EXISTS idx_catalog_price ON catalog(price);

-- Composite index for common filter combos
CREATE INDEX IF NOT EXISTS idx_catalog_source_price ON catalog(source, price);
