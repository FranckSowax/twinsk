-- ================================================
-- Twinsk — Backfill catalog from existing search_results
-- À exécuter UNE SEULE FOIS après migration #8
-- ================================================

-- Insert unique products into catalog, keeping the best version (most recent, with most data)
INSERT INTO catalog (
  source, external_id, title, title_original, description, description_original,
  price, image_url, main_image_url, extra_images, seller, product_url,
  moq, weight, volume, dimensions, search_count, last_seen_at, created_at
)
SELECT DISTINCT ON (source, COALESCE(taobao_item_id, ''))
  source,
  CASE
    WHEN source = 'factory' THEN 'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text
    WHEN source = 'manual' THEN 'manual_' || id::text
    ELSE COALESCE(taobao_item_id, '')
  END AS external_id,
  title,
  title_original,
  description,
  description_original,
  price,
  image_url,
  main_image_url,
  extra_images,
  seller,
  product_url,
  moq,
  weight,
  volume,
  dimensions,
  -- Count how many times this product appears across all search_results
  COUNT(*) OVER (PARTITION BY source, COALESCE(taobao_item_id, '')) AS search_count,
  MAX(created_at) OVER (PARTITION BY source, COALESCE(taobao_item_id, '')) AS last_seen_at,
  MIN(created_at) OVER (PARTITION BY source, COALESCE(taobao_item_id, '')) AS created_at
FROM search_results
WHERE source IN ('taobao', '1688')
  AND taobao_item_id IS NOT NULL
  AND taobao_item_id != ''
ORDER BY source, COALESCE(taobao_item_id, ''), created_at DESC
ON CONFLICT (source, external_id) DO UPDATE SET
  search_count = catalog.search_count + EXCLUDED.search_count,
  last_seen_at = GREATEST(catalog.last_seen_at, EXCLUDED.last_seen_at),
  price = CASE WHEN EXCLUDED.price > 0 THEN EXCLUDED.price ELSE catalog.price END,
  title = COALESCE(NULLIF(EXCLUDED.title, ''), catalog.title);

-- Factories (use hash of name+city as external_id)
INSERT INTO catalog (
  source, external_id, title, title_original, description, description_original,
  price, image_url, main_image_url, seller, product_url,
  moq, search_count, last_seen_at, created_at
)
SELECT DISTINCT ON ('factory', 'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text)
  'factory'::text,
  'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text,
  title,
  title_original,
  description,
  description_original,
  price,
  image_url,
  main_image_url,
  seller,
  product_url,
  moq,
  COUNT(*) OVER (PARTITION BY title, seller),
  MAX(created_at) OVER (PARTITION BY title, seller),
  MIN(created_at) OVER (PARTITION BY title, seller)
FROM search_results
WHERE source = 'factory'
ORDER BY 'factory', 'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text, created_at DESC
ON CONFLICT (source, external_id) DO UPDATE SET
  search_count = catalog.search_count + EXCLUDED.search_count,
  last_seen_at = GREATEST(catalog.last_seen_at, EXCLUDED.last_seen_at);

-- Manual entries (each is unique)
INSERT INTO catalog (
  source, external_id, title, title_original, description, description_original,
  price, image_url, main_image_url, extra_images, seller, product_url,
  moq, weight, volume, dimensions, search_count, last_seen_at, created_at
)
SELECT
  'manual'::text,
  'manual_' || id::text,
  title, title_original, description, description_original,
  price, image_url, main_image_url, extra_images, seller, product_url,
  moq, weight, volume, dimensions,
  1,
  created_at,
  created_at
FROM search_results
WHERE source = 'manual'
ON CONFLICT (source, external_id) DO NOTHING;

-- Now link search_results back to catalog via catalog_id
UPDATE search_results sr
SET catalog_id = c.id
FROM catalog c
WHERE sr.catalog_id IS NULL
  AND sr.source = c.source
  AND (
    (sr.source IN ('taobao', '1688') AND sr.taobao_item_id = c.external_id)
    OR (sr.source = 'factory' AND c.external_id = 'f_' || abs(hashtext(lower(sr.title) || ':' || lower(COALESCE(sr.seller, ''))))::text)
    OR (sr.source = 'manual' AND c.external_id = 'manual_' || sr.id::text)
  );

-- Stats
SELECT
  source,
  COUNT(*) as count,
  SUM(search_count) as total_appearances
FROM catalog
GROUP BY source
ORDER BY count DESC;
