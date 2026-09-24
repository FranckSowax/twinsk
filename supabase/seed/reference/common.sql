-- Données de référence communes à tous les pays. Idempotent.
--
-- Aucune à ce jour : le schéma n'a pas de table de référence partagée
-- (catégories, unités…). Les réglages (wa_settings) sont des données
-- d'exploitation propres à chaque pays ; l'application retombe sur les
-- valeurs par défaut de src/content/<pays>/ tant qu'ils sont vides.
-- Ce fichier existe pour que l'ordre d'exécution reste le même partout :
--   psql "$DB_URL" -f supabase/seed/reference/common.sql
--   psql "$DB_URL" -f supabase/seed/reference/<PAYS>.sql
SELECT 1 AS common_reference_seed_ok;
