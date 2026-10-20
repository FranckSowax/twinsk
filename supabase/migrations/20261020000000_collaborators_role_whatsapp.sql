-- ================================================
-- Collaborateurs : rôle « whatsapp » (messagerie clients) — 20 oct. 2026.
-- Le rôle existe dans l'application (src/lib/collab-roles.ts) mais la
-- contrainte de la table ne connaissait que production, commandes et
-- sourcing : créer un collaborateur WhatsApp échouait sur
-- « collaborators_role_check ». Idempotente.
-- ================================================
ALTER TABLE public.collaborators DROP CONSTRAINT IF EXISTS collaborators_role_check;
ALTER TABLE public.collaborators
  ADD CONSTRAINT collaborators_role_check
  CHECK (role = ANY (ARRAY['production'::text, 'commandes'::text, 'sourcing'::text, 'whatsapp'::text]));
