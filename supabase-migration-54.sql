-- ================================================
-- Twinsk — Migration #54
-- Catalogue WhatsApp : une collection par CATÉGORIE (et par phase pour le B2B)
-- au lieu d'une seule collection par listing.
-- WhatsApp ne gère pas les sous-collections : la hiérarchie est encodée dans le
-- nom (« Phase · Catégorie »). item_id = offer_items.id ('' = collection listing
-- historique, conservée).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE wa_catalog_collections
  ADD COLUMN IF NOT EXISTS item_id TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wa_catalog_collections_pkey'
      AND conrelid = 'wa_catalog_collections'::regclass
      AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE wa_catalog_collections DROP CONSTRAINT wa_catalog_collections_pkey;
    ALTER TABLE wa_catalog_collections ADD PRIMARY KEY (offer_id, item_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wa_catalog_collections_offer_idx
  ON wa_catalog_collections (offer_id);

COMMENT ON TABLE wa_catalog_collections IS
  'Collections WhatsApp créées par catégorie de listing (offer_id + item_id).';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE wa_catalog_collections DROP CONSTRAINT wa_catalog_collections_pkey;
-- ALTER TABLE wa_catalog_collections DROP COLUMN item_id;
-- ALTER TABLE wa_catalog_collections ADD PRIMARY KEY (offer_id);
