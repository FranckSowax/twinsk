-- ================================================
-- Twinsk — Migration #52
-- Synchro catalogue WhatsApp Business : correspondance entre les produits
-- des listings et les produits du catalogue WhatsApp (via WHAPI), et
-- collections créées par listing.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS wa_catalog_products (
  product_id    TEXT PRIMARY KEY,          -- offer_products.id (pas de FK dure : produits réimportables)
  offer_id      UUID NOT NULL,
  wa_product_id TEXT NOT NULL,             -- id du produit dans le catalogue WhatsApp
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_catalog_products_offer_idx ON wa_catalog_products (offer_id);

CREATE TABLE IF NOT EXISTS wa_catalog_collections (
  offer_id         UUID PRIMARY KEY,
  wa_collection_id TEXT,
  name             TEXT,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE wa_catalog_products IS
  'Produits de listings publiés dans le catalogue WhatsApp Business (bouton « Publier au catalogue » de l''admin).';
COMMENT ON TABLE wa_catalog_collections IS
  'Collections WhatsApp créées par listing (une collection = un listing).';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP TABLE IF EXISTS wa_catalog_products;
-- DROP TABLE IF EXISTS wa_catalog_collections;
