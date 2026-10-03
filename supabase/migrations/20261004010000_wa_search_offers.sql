-- ================================================
-- Recherches WhatsApp → offre proposée au client (4 oct. 2026).
--
-- L'agent Hermes prend une recherche, l'interprète et fait créer par son agent
-- sourcing une offre B2C (brouillon) rattachée à la recherche. L'équipe peut
-- aussi coller un lien à la main. Avant l'envoi au client, une personne
-- vérifie l'offre (marges, complétude) puis l'envoie sur WhatsApp.
-- Non destructive, idempotente.
-- ================================================

ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS interpretation text;
ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS offer_url text;
-- Recherche prise en charge par l'agent (évite deux traitements en parallèle).
ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS agent_claimed_at timestamptz;
ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS agent_claimed_by text;
-- Vérification humaine (marges, complétude) : obligatoire avant l'envoi.
ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS checked_at timestamptz;
ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS checked_by text;
-- Envoi au client sur WhatsApp.
ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.wa_searches ADD COLUMN IF NOT EXISTS sent_by text;

CREATE INDEX IF NOT EXISTS wa_searches_offer_idx ON public.wa_searches (offer_id);
