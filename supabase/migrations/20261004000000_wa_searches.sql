-- ================================================
-- Recherches clients venues de WhatsApp (4 oct. 2026).
--
-- Table à part des demandes de devis (`requests`) : un collaborateur note ou
-- colle, depuis la messagerie, ce que le client cherche et y joint les photos
-- envoyées par le client. Elles ont leur propre onglet « Recherches WhatsApp ».
-- Accès serveur uniquement (service_role) : RLS active sans politique.
-- Non destructive, idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS public.wa_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Origine : messagerie (bouton « Recherche ») ; « group » réservé au groupe Oh My Recherche.
  source text NOT NULL DEFAULT 'inbox' CHECK (source IN ('inbox', 'group')),
  conversation_id uuid REFERENCES public.wa_conversations(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  -- Ce que le client cherche (texte noté ou collé par l'équipe).
  request text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'searching', 'proposal_sent', 'done', 'cancelled')),
  -- Note interne de l'équipe (jamais envoyée au client).
  note text,
  created_by text,
  created_by_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_searches_created_idx ON public.wa_searches (created_at DESC);
CREATE INDEX IF NOT EXISTS wa_searches_status_idx ON public.wa_searches (status, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_searches_conversation_idx ON public.wa_searches (conversation_id);

CREATE TABLE IF NOT EXISTS public.wa_search_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid NOT NULL REFERENCES public.wa_searches(id) ON DELETE CASCADE,
  -- Copie durable de la photo (stockage public request-images).
  url text NOT NULL,
  caption text,
  -- Message WhatsApp d'origine (wa_messages.id).
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_search_images_search_idx ON public.wa_search_images (search_id, created_at);

ALTER TABLE public.wa_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_search_images ENABLE ROW LEVEL SECURITY;
