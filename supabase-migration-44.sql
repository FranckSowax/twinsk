-- ================================================
-- Twinsk — Migration #44
-- Espace Agents Gabon : whitelist agents, OTP WhatsApp, audit des actions,
-- suivi de l'encaissement cash. Idempotente. À exécuter dans le SQL Editor.
-- ================================================

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agents_phone_key ON agents (phone);

CREATE TABLE IF NOT EXISTS agent_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_otps_agent_idx ON agent_otps (agent_id, created_at DESC);
ALTER TABLE agent_otps ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES offer_orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_actions_order_idx ON agent_actions (order_id, created_at DESC);

ALTER TABLE offer_orders
  ADD COLUMN IF NOT EXISTS cash_collected_by uuid,
  ADD COLUMN IF NOT EXISTS cash_collected_at timestamptz;

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_orders DROP COLUMN IF EXISTS cash_collected_by, DROP COLUMN IF EXISTS cash_collected_at;
-- DROP TABLE IF EXISTS agent_actions;
-- DROP TABLE IF EXISTS agent_otps;
-- DROP TABLE IF EXISTS agents;
