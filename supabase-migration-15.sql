-- ================================================
-- Twinsk — Migration #15
-- Choix de la devise principale affichee au client sur /proposal
-- A executer dans le SQL Editor de Supabase Dashboard
-- ================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS proposal_currency TEXT NOT NULL DEFAULT 'CNY';

COMMENT ON COLUMN requests.proposal_currency IS
  'Devise principale affichee en grand sur /proposal/[uuid] : CNY | USD | EUR | XAF';

-- Add check constraint to enforce valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'requests_proposal_currency_check'
  ) THEN
    ALTER TABLE requests
      ADD CONSTRAINT requests_proposal_currency_check
      CHECK (proposal_currency IN ('CNY', 'USD', 'EUR', 'XAF'));
  END IF;
END $$;
