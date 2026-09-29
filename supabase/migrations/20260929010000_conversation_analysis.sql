-- ================================================
-- Analyse IA des conversations WhatsApp (29 sept. 2026).
--
-- 1. wa_conversation_analyses : une ligne par analyse (historique conservé).
--    Champs génériques en colonnes, bloc commerce en jsonb (`commerce`).
-- 2. wa_conversations : dernier résultat dénormalisé et indexé, pour filtrer
--    et trier la messagerie (clients chauds, risque d'abandon).
-- 3. wa_daily_reports : un rapport par jour (fuseau du pays).
--
-- Non destructive : colonnes ajoutées nullable, tables créées si absentes.
-- Accès serveur uniquement (service_role) : RLS active sans politique.
-- ================================================

CREATE TABLE IF NOT EXISTS public.wa_conversation_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  -- Dernier message pris en compte (pas de ré-analyse sans nouveau message).
  last_message_id text,
  message_count integer NOT NULL DEFAULT 0,
  -- Génériques
  sentiment text,
  urgency_level text,
  resolution_status text,
  satisfaction_score integer,
  customer_need_summary text,
  topic_tags text[] NOT NULL DEFAULT '{}',
  language text,
  intent_category text,
  purchase_stage text,
  purchase_intent_score integer,
  abandon_risk text,
  next_best_action text,
  -- Bloc commerce : produits, objections, transport, paiement, zone, stades
  -- (modèle / faits), prochaine action détaillée, questions mal traitées…
  commerce jsonb NOT NULL DEFAULT '{}'::jsonb,
  listing_id uuid,
  -- Consommation
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_fcfa numeric NOT NULL DEFAULT 0,
  -- Qui a lancé : 'cron' ou l'auteur d'une ré-analyse manuelle.
  triggered_by text
);

CREATE INDEX IF NOT EXISTS wa_conversation_analyses_conv_idx ON public.wa_conversation_analyses (conversation_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS wa_conversation_analyses_date_idx ON public.wa_conversation_analyses (analyzed_at DESC);
ALTER TABLE public.wa_conversation_analyses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS purchase_stage text,
  ADD COLUMN IF NOT EXISTS purchase_intent_score integer,
  ADD COLUMN IF NOT EXISTS abandon_risk text,
  ADD COLUMN IF NOT EXISTS next_best_action text,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS analyzed_message_id text;

CREATE INDEX IF NOT EXISTS wa_conversations_stage_idx ON public.wa_conversations (purchase_stage);
CREATE INDEX IF NOT EXISTS wa_conversations_intent_idx ON public.wa_conversations (purchase_intent_score DESC);
CREATE INDEX IF NOT EXISTS wa_conversations_risk_idx ON public.wa_conversations (abandon_risk);

CREATE TABLE IF NOT EXISTS public.wa_daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Jour du rapport dans le fuseau du pays.
  report_date date NOT NULL UNIQUE,
  analyzed_count integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_carts integer NOT NULL DEFAULT 0,
  pending_carts_total numeric NOT NULL DEFAULT 0,
  insights text[] NOT NULL DEFAULT '{}',
  recommendations text,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_fcfa numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_daily_reports ENABLE ROW LEVEL SECURITY;
