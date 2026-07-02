-- ================================================
-- Twinsk — Migration #22
-- Suivi des réponses aux sondages WhatsApp (webhooks WHAPI, événement poll_update)
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS whapi_polls (
  id          TEXT PRIMARY KEY,                    -- ID du message sondage (WHAPI)
  chat_id     TEXT,                                -- groupe/chat où le sondage a été posté
  title       TEXT,                                -- question du sondage
  results     JSONB,                               -- [{name, count, voters[], id}]
  total_votes INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whapi_polls_updated_idx ON whapi_polls (updated_at DESC);

COMMENT ON TABLE whapi_polls IS
  'Résultats des sondages WhatsApp, alimentés par le webhook WHAPI (messages type poll_update). Upsert par id de message.';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP TABLE IF EXISTS whapi_polls;
