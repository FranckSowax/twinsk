-- ================================================
-- Twinsk — Migration #48
-- Rôles collaborateurs : production (défaut, accès actuel sourcing+offres),
-- commandes (gestion des commandes reçues de l'app uniquement),
-- sourcing (accès aux offres B2B uniquement).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE collaborators
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'production';

ALTER TABLE collaborators
  ADD COLUMN IF NOT EXISTS default_locale TEXT NOT NULL DEFAULT 'fr';

DO $$
BEGIN
  ALTER TABLE collaborators
    ADD CONSTRAINT collaborators_role_check
    CHECK (role IN ('production', 'commandes', 'sourcing'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE collaborators
    ADD CONSTRAINT collaborators_default_locale_check
    CHECK (default_locale IN ('fr', 'zh'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN collaborators.role IS
  'production = sourcing + offres + révisions | commandes = commandes app + révisions | sourcing = sourcing + offres B2C/B2B.';
COMMENT ON COLUMN collaborators.default_locale IS
  'Langue d''interface par défaut du collaborateur (fr | zh), choisie à la création.';

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE collaborators DROP CONSTRAINT IF EXISTS collaborators_role_check;
-- ALTER TABLE collaborators DROP CONSTRAINT IF EXISTS collaborators_default_locale_check;
-- ALTER TABLE collaborators DROP COLUMN IF EXISTS role;
-- ALTER TABLE collaborators DROP COLUMN IF EXISTS default_locale;
