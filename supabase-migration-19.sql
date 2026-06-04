-- ================================================
-- Twinsk — Migration #19
-- Notes collaborateurs sur la fiche de synthese commande
-- (avec cache de traduction FR -> EN / ZH)
-- ================================================

CREATE TABLE IF NOT EXISTS order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'collaborateur',
  message TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'fr',
  message_en TEXT,
  message_zh TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_notes_request_id_idx
  ON order_notes (request_id, created_at DESC);

COMMENT ON TABLE order_notes IS
  'Notes ajoutees par les collaborateurs sur la fiche /order-summary. message_en et message_zh sont des caches remplis a la demande via Kimi.';
