-- ================================================
-- Twinsk — Migration #35
-- Marque blanche partenaires/affiliés : un affilié (boutique) reçoit un lien de
-- gestion d'une offre, ajoute sa commission, masque/réordonne les produits, et
-- partage son lien public. Les ventes lui sont attribuées (KPIs + notifications).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

-- Profil affilié / partenaire (boutique).
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shop_name TEXT NOT NULL DEFAULT '',      -- rempli par le partenaire à l'inscription
  airtel_number TEXT,                      -- son numéro Airtel Money
  whatsapp_number TEXT,                    -- pour les notifications de vente
  active BOOLEAN NOT NULL DEFAULT true
);

-- Lien offre ↔ affilié (l'UUID sert de jeton : /partenaire/[id] et /b/[id]).
CREATE TABLE IF NOT EXISTS affiliate_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  commission_percent NUMERIC NOT NULL DEFAULT 0,        -- majoration affichée au client
  hidden_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- produits masqués sur /b
  item_order JSONB,                                      -- ordre des catégories (ids)
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_offer ON affiliate_offers(offer_id);

-- Demandes de produits de l'affilié vers l'admin (prochaines offres).
CREATE TABLE IF NOT EXISTS affiliate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  affiliate_offer_id UUID,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'       -- new | seen | done
);

-- Attribution des ventes.
ALTER TABLE offer_orders
  ADD COLUMN IF NOT EXISTS affiliate_offer_id UUID REFERENCES affiliate_offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_fcfa NUMERIC;      -- commission de l'affilié sur la commande

COMMENT ON TABLE affiliates IS 'Partenaires marque blanche (boutique, Airtel Money, WhatsApp).';
COMMENT ON TABLE affiliate_offers IS 'Offre gérée en marque blanche par un affilié (commission, masquage, ordre). UUID = jeton des liens /partenaire et /b.';
COMMENT ON COLUMN offer_orders.commission_fcfa IS 'Commission affilié (FCFA) incluse dans les prix de la commande.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_orders DROP COLUMN IF EXISTS affiliate_offer_id, DROP COLUMN IF EXISTS affiliate_id, DROP COLUMN IF EXISTS commission_fcfa;
-- DROP TABLE IF EXISTS affiliate_requests;
-- DROP TABLE IF EXISTS affiliate_offers;
-- DROP TABLE IF EXISTS affiliates;
