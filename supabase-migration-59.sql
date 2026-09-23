-- ================================================
-- Twinsk — Migration #59
-- Messagerie WhatsApp (/admin/inbox) : conversations privées reçues sur le
-- numéro WHAPI, messages entrants et sortants, attribution à un collaborateur
-- ou à l'admin, statut (à répondre / répondue / clôturée). Le fil WhatsApp
-- lui-même n'est jamais modifié : ces tables ne servent qu'au suivi.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS wa_conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id              TEXT UNIQUE NOT NULL,        -- 24107…@s.whatsapp.net
  phone                TEXT NOT NULL,               -- chiffres seuls
  name                 TEXT,                        -- nom WhatsApp du client (from_name)
  status               TEXT NOT NULL DEFAULT 'open',-- open | replied | closed
  unread_count         INTEGER NOT NULL DEFAULT 0,  -- messages client depuis notre dernière réponse
  last_message_at      TIMESTAMPTZ,
  last_message_preview TEXT,
  last_inbound_at      TIMESTAMPTZ,
  last_outbound_at     TIMESTAMPTZ,
  assigned_to          TEXT,                        -- 'admin' ou id du collaborateur
  assigned_name        TEXT,
  assigned_at          TIMESTAMPTZ,
  note                 TEXT,                        -- note interne (jamais envoyée)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_conversations_status_idx ON wa_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS wa_conversations_assigned_idx ON wa_conversations (assigned_to, last_message_at DESC);

CREATE TABLE IF NOT EXISTS wa_messages (
  id              TEXT PRIMARY KEY,                 -- id WHAPI (ou local-… si l'envoi n'en renvoie pas)
  conversation_id UUID NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  chat_id         TEXT NOT NULL,
  from_me         BOOLEAN NOT NULL DEFAULT false,
  type            TEXT NOT NULL,                    -- text | image | video | audio | document | sticker | location | contact | order
  text            TEXT,
  media_url       TEXT,
  media_kind      TEXT,                             -- image | video | audio | document | sticker
  filename        TEXT,
  sender_name     TEXT,                             -- client (entrant) ou collaborateur (sortant)
  sent_by         TEXT,                             -- 'admin' | id collaborateur | NULL (envoyé depuis le téléphone)
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_messages_conversation_idx ON wa_messages (conversation_id, sent_at);
