-- ================================================
-- Twinsk — Migration #21
-- Support du schéma catalogue JSON `twinsk_catalogue_v3.1`
--   • paliers de prix, images de détail, total SKU, source, prix « sur devis »
--   • meta d'offre (marché cible, tri, mode, note, qualité interne)
-- À exécuter dans le SQL Editor de Supabase (ou via MCP apply_migration).
-- Additive, idempotente, rétro-compatible : les offres existantes restent valides.
-- ================================================

-- ---- Produits d'offre : nouveaux champs v3.1 ---------------------------------
ALTER TABLE offer_products
  ADD COLUMN IF NOT EXISTS price_tiers        JSONB,    -- [{min_qty:int, price:number}] trié par min_qty
  ADD COLUMN IF NOT EXISTS detail_images      JSONB,    -- galerie secondaire (schémas cotés, certificats, usine)
  ADD COLUMN IF NOT EXISTS variants_total     INTEGER,  -- nb RÉEL de SKU quand variants[] est un échantillon
  ADD COLUMN IF NOT EXISTS description_source TEXT;     -- provenance des données (INTERNE, non exposé au client)

-- Prix « sur devis » : price peut désormais valoir NULL (masqué). 0 reste 0.
-- (No-op si la colonne est déjà nullable.)
ALTER TABLE offer_products
  ALTER COLUMN price DROP NOT NULL;

COMMENT ON COLUMN offer_products.price_tiers IS
  'Paliers de prix par quantité [{min_qty,price}] (CNY), triés par min_qty croissant. Donnée devis prioritaire.';
COMMENT ON COLUMN offer_products.detail_images IS
  'Images de la description longue (schémas cotés, certificats, photos usine), distinctes de extra_images.';
COMMENT ON COLUMN offer_products.variants_total IS
  'Nombre réel de SKU quand variants[] n''est qu''un échantillon représentatif (ex: 44 pour 5 listées).';
COMMENT ON COLUMN offer_products.description_source IS
  'Mention de provenance des données. Usage INTERNE — ne jamais exposer au client final.';

-- Note : video_url du JSON v3.1 est replié dans la colonne existante `videos` (JSONB)
--        au moment de l'ingestion — aucune colonne dédiée n'est nécessaire.

-- ---- Offres : meta catalogue --------------------------------------------------
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS marche_cible TEXT,   -- ex: "Afrique (import conteneur maritime)"
  ADD COLUMN IF NOT EXISTS tri          TEXT,   -- ex: "ventes / réachat"
  ADD COLUMN IF NOT EXISTS mode         TEXT,   -- "catalogue interne …" | "catalogue public …" (INTERNE)
  ADD COLUMN IF NOT EXISTS note         TEXT,   -- note d'analyse sourcing (chapô contexte offre)
  ADD COLUMN IF NOT EXISTS quality      JSONB;  -- {products,variants,images,warnings_count,warnings[]} (INTERNE)

COMMENT ON COLUMN offers.mode IS
  'Mode du catalogue source (interne/public). Usage INTERNE — ne jamais exposer au client final.';
COMMENT ON COLUMN offers.quality IS
  'Bloc qualité sourcing (compteurs + warnings). Usage INTERNE — ne jamais exposer au client final.';

-- ================================================
-- ROLLBACK (à exécuter manuellement si besoin de revenir en arrière)
-- ================================================
-- ALTER TABLE offer_products
--   DROP COLUMN IF EXISTS price_tiers,
--   DROP COLUMN IF EXISTS detail_images,
--   DROP COLUMN IF EXISTS variants_total,
--   DROP COLUMN IF EXISTS description_source;
-- -- Restaurer la contrainte NOT NULL sur price nécessite d'abord de remplacer les NULL :
-- --   UPDATE offer_products SET price = 0 WHERE price IS NULL;
-- --   ALTER TABLE offer_products ALTER COLUMN price SET NOT NULL;
-- ALTER TABLE offers
--   DROP COLUMN IF EXISTS marche_cible,
--   DROP COLUMN IF EXISTS tri,
--   DROP COLUMN IF EXISTS mode,
--   DROP COLUMN IF EXISTS note,
--   DROP COLUMN IF EXISTS quality;
