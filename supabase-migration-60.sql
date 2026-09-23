-- ================================================
-- Twinsk — Migration #60
-- Messagerie WhatsApp : accusés de réception de nos messages, comme dans
-- WhatsApp (1 coche grise = envoyé, 2 grises = reçu, 2 bleues = lu).
-- Alimentés par l'événement WHAPI `statuses` et par la récupération
-- d'historique. Le code fonctionne sans ces colonnes (coche simple).
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

ALTER TABLE wa_messages      ADD COLUMN IF NOT EXISTS status               TEXT;        -- pending | sent | delivered | read | played | failed
ALTER TABLE wa_messages      ADD COLUMN IF NOT EXISTS status_at            TIMESTAMPTZ;
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS last_outbound_status TEXT;        -- statut de notre dernier message (coches de la liste)
