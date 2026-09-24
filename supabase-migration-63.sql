-- ================================================
-- Twinsk — Migration #63 — Paiements en ligne + reversement des affiliés
--  1. Table `payments` : une ligne par facture d'un prestataire de paiement en
--     ligne (PayDunya en Côte d'Ivoire). Référence unique (provider,
--     provider_ref) : l'IPN et la vérification au retour du client s'y
--     rattachent sans créer de doublon. Accès serveur uniquement (RLS active,
--     aucune policy : seule la clé service_role lit et écrit).
--  2. Affiliés (décision D5) : numéro d'encaissement générique
--     `payout_number` + opérateur `payout_provider`. La colonne historique
--     `airtel_number` reste lue en repli ; le Gabon continue d'y écrire.
-- Purement additive : aucun effet sur le Gabon tant que rien n'écrit dans ces
-- nouveaux objets. À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

-- 1. Paiements en ligne
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,                       -- 'paydunya'
  provider_ref  TEXT NOT NULL,                       -- jeton de facture du prestataire
  order_id      UUID REFERENCES offer_orders(id) ON DELETE SET NULL,
  amount        NUMERIC NOT NULL,                    -- montant facturé (FCFA)
  currency      TEXT NOT NULL,                       -- 'XOF' / 'XAF'
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
  receipt_url   TEXT,
  raw           JSONB,                               -- dernière réponse du prestataire
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_provider_ref_key UNIQUE (provider, provider_ref)
);
CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments(order_id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 2. Affiliés : numéro d'encaissement générique (D5)
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS payout_number TEXT;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS payout_provider TEXT;  -- 'airtel_money', 'orange_money', 'wave'…
