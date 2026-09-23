-- ================================================
-- Twinsk — Migration #61
-- Messagerie WhatsApp : contexte des messages et origine des conversations.
--  - wa_messages.context : publicité d'origine (clic sur une pub Facebook /
--    Instagram « Envoyer un message WhatsApp » : titre, texte, image, lien,
--    identifiant de la pub) et message cité quand le client répond à un
--    message précis.
--  - wa_conversations.source : dernière publicité par laquelle le client est
--    arrivé (affichée dans la liste et l'en-tête de la conversation).
-- Le code fonctionne sans ces colonnes (sans carte de pub ni citation).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE wa_messages      ADD COLUMN IF NOT EXISTS context JSONB;
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS source  JSONB;
