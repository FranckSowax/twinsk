-- ================================================
-- Twinsk — Backfill catalog from existing search_results
-- À exécuter UNE SEULE FOIS après migration #8
-- ================================================

-- Step 1: Insert Taobao + 1688 products (deduplicated by source + taobao_item_id)
INSERT INTO catalog (
  source, external_id, title, title_original, description, description_original,
  price, image_url, main_image_url, extra_images, seller, product_url,
  moq, weight, volume, dimensions, search_count, last_seen_at, created_at
)
SELECT
  sub.source, sub.external_id, sub.title, sub.title_original,
  sub.description, sub.description_original, sub.price,
  sub.image_url, sub.main_image_url, sub.extra_images,
  sub.seller, sub.product_url, sub.moq, sub.weight, sub.volume, sub.dimensions,
  sub.cnt, sub.max_created, sub.min_created
FROM (
  SELECT DISTINCT ON (source, taobao_item_id)
    source,
    taobao_item_id AS external_id,
    title, title_original, description, description_original,
    price, image_url, main_image_url, extra_images,
    seller, product_url, moq, weight, volume, dimensions,
    COUNT(*) OVER (PARTITION BY source, taobao_item_id) AS cnt,
    MAX(created_at) OVER (PARTITION BY source, taobao_item_id) AS max_created,
    MIN(created_at) OVER (PARTITION BY source, taobao_item_id) AS min_created
  FROM search_results
  WHERE source IN ('taobao', '1688')
    AND taobao_item_id IS NOT NULL
    AND taobao_item_id != ''
  ORDER BY source, taobao_item_id, created_at DESC
) sub
ON CONFLICT (source, external_id) DO UPDATE SET
  search_count = catalog.search_count + EXCLUDED.search_count,
  last_seen_at = GREATEST(catalog.last_seen_at, EXCLUDED.last_seen_at),
  price = CASE WHEN EXCLUDED.price > 0 THEN EXCLUDED.price ELSE catalog.price END;

-- Step 2: Insert factories (deduplicated by hash of name+city)
INSERT INTO catalog (
  source, external_id, title, title_original, description, description_original,
  price, image_url, main_image_url, seller, product_url,
  moq, search_count, last_seen_at, created_at
)
SELECT
  sub.source, sub.external_id, sub.title, sub.title_original,
  sub.description, sub.description_original, sub.price,
  sub.image_url, sub.main_image_url, sub.seller, sub.product_url,
  sub.moq, sub.cnt, sub.max_created, sub.min_created
FROM (
  SELECT DISTINCT ON (
    'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text
  )
    'factory'::text AS source,
    'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text AS external_id,
    title, title_original, description, description_original,
    price, image_url, main_image_url, seller, product_url, moq,
    COUNT(*) OVER (
      PARTITION BY 'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text
    ) AS cnt,
    MAX(created_at) OVER (
      PARTITION BY 'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text
    ) AS max_created,
    MIN(created_at) OVER (
      PARTITION BY 'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text
    ) AS min_created,
    created_at
  FROM search_results
  WHERE source = 'factory'
  ORDER BY
    'f_' || abs(hashtext(lower(title) || ':' || lower(COALESCE(seller, ''))))::text,
    created_at DESC
) sub
ON CONFLICT (source, external_id) DO UPDATE SET
  search_count = catalog.search_count + EXCLUDED.search_count,
  last_seen_at = GREATEST(catalog.last_seen_at, EXCLUDED.last_seen_at);

-- Step 3: Insert manual entries (each is unique)
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
  1, created_at, created_at
FROM search_results
WHERE source = 'manual'
ON CONFLICT (source, external_id) DO NOTHING;

-- Step 4: Link search_results → catalog via catalog_id
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
SELECT source, COUNT(*) as count, SUM(search_count) as total_appearances
FROM catalog GROUP BY source ORDER BY count DESC;
