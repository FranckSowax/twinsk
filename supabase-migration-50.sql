-- ================================================
-- Twinsk — Migration #50
-- Playbook WhatsApp (/admin/playbook) :
--   - wa_departures : groupes de départ logistique (aérien/maritime) et leur cycle de vie
--   - playbook_log  : journal des rituels (récap vendredi, bienvenue, épingles…)
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS wa_departures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           TEXT NOT NULL CHECK (kind IN ('air', 'sea')),
  label          TEXT NOT NULL,              -- ex: "✈️ Départ Air · 05 sept"
  departure_date DATE,
  cutoff_date    DATE,
  group_id       TEXT,                       -- JID WhatsApp (…@g.us)
  invite_link    TEXT,
  status         TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'cutoff', 'loaded', 'transit', 'arrived', 'closed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_departures_status_idx ON wa_departures (status, departure_date DESC);

CREATE TABLE IF NOT EXISTS playbook_log (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual  TEXT NOT NULL,   -- recap_friday | welcome_sunday | pins_renewal | listing_post | poll_thursday
  note    TEXT,
  done_by TEXT,
  done_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playbook_log_ritual_idx ON playbook_log (ritual, done_at DESC);

COMMENT ON TABLE wa_departures IS
  'Groupes WhatsApp de départ logistique (un groupe par expédition aérienne/maritime), avec statut du cycle de vie.';
COMMENT ON TABLE playbook_log IS
  'Journal des rituels du playbook WhatsApp (qui a fait quoi, quand) — alimente la checklist de la page /admin/playbook.';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP TABLE IF EXISTS playbook_log;
-- DROP TABLE IF EXISTS wa_departures;
