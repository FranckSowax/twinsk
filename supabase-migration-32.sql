-- ================================================
-- Twinsk — Migration #32
-- Historique des JSON importés (bulk-load) sur une offre ou une demande, pour
-- pouvoir les recopier/réutiliser sur une autre commande.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS json_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_type TEXT NOT NULL,        -- 'offer' | 'request'
  target_id UUID NOT NULL,          -- id de l'offre / de la demande
  label TEXT,                       -- meta.name ou libellé lisible
  product_count INTEGER,            -- nb de produits importés
  payload JSONB NOT NULL            -- le JSON brut tel qu'importé
);

CREATE INDEX IF NOT EXISTS idx_json_imports_target ON json_imports (target_type, target_id, created_at DESC);

COMMENT ON TABLE json_imports IS 'Copie des JSON importés (bulk-load) pour réutilisation ultérieure.';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP TABLE IF EXISTS json_imports;
