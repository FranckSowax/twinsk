-- ================================================
-- Twinsk — Migration #23
-- Accès collaborateur : comptes restreints (offer/request) + journal d'audit.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

-- Comptes collaborateurs (gérés par l'admin). Mot de passe stocké HASHÉ (scrypt).
CREATE TABLE IF NOT EXISTS collaborators (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- Journal des actions collaborateurs (audit : qui / quoi / quand).
CREATE TABLE IF NOT EXISTS collab_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id   UUID,
  collaborator_name TEXT,
  action            TEXT NOT NULL,   -- ex: update_product, add_product, add_item, move_product
  target_type       TEXT,            -- 'offer' | 'request'
  target_id         TEXT,
  description       TEXT,            -- résumé lisible (ex: "Dimensions, Poids modifiés")
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collab_actions_created_idx ON collab_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS collab_actions_collab_idx ON collab_actions (collaborator_id, created_at DESC);

COMMENT ON TABLE collaborators IS
  'Comptes collaborateurs (accès restreint /offer + /request). password_hash = scrypt salt:hash.';
COMMENT ON TABLE collab_actions IS
  'Journal d''audit des actions collaborateurs (mise à jour de fiches produits).';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP TABLE IF EXISTS collab_actions;
-- DROP TABLE IF EXISTS collaborators;
