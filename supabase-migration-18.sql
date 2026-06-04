-- ================================================
-- Twinsk — Migration #18
-- Reference vers le devis final (publie au client)
-- ================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS final_quote_id UUID;

COMMENT ON COLUMN requests.final_quote_id IS
  'ID du devis final genere depuis /order-summary une fois toutes les infos completes. Permet d afficher un badge "Devis disponible" sur /proposal.';
