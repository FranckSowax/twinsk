-- ================================================
-- Twinsk — Migration #51
-- Réglages WhatsApp (clé/valeur) : communauté « Oh My Group » liée et
-- correspondance des sous-groupes structurels (offres, B2B, salon).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS wa_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE wa_settings IS
  'Réglages WhatsApp : key=''community'' → {community_id, announce_group_id} · key=''slots'' → {offers, b2b, salon} (group ids @g.us).';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP TABLE IF EXISTS wa_settings;
