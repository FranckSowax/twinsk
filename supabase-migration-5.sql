-- ================================================
-- Twinsk Sourcing System — Migration #5
-- Ajoute support de la proposition client (review)
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

-- Colonne pour la décision finale du client sur chaque résultat présélectionné
-- NULL = pas encore décidé, true = validé par le client, false = rejeté
ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS client_selected BOOLEAN;

-- Étend l'enum de statut pour refléter la review client
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'request_status' AND e.enumlabel = 'client_reviewed'
  ) THEN
    ALTER TYPE request_status ADD VALUE 'client_reviewed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'request_status' AND e.enumlabel = 'proposal_sent'
  ) THEN
    ALTER TYPE request_status ADD VALUE 'proposal_sent';
  END IF;
END $$;
