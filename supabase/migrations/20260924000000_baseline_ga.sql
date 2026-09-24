-- ================================================================
-- Schéma de base (baseline) — état du projet Gabon au 24 septembre 2026
-- ================================================================
-- Remplace, comme point de départ, les 61 fichiers supabase-migration-N.sql
-- appliqués à la main et les 14 migrations MCP de mai 2026 (hors dépôt).
--
-- Reconstruit depuis le catalogue PostgreSQL du projet Gabon (requêtes SELECT
-- uniquement : pg_get_functiondef, pg_get_constraintdef, pg_get_indexdef,
-- pg_get_triggerdef, pg_policy). Vérifié en l'appliquant sur un Postgres 17
-- vierge puis en comparant une empreinte (md5) du schéma public des deux côtés :
-- colonnes, contraintes, index, déclencheurs, politiques, RLS, fonctions,
-- types et commentaires sont identiques (634 colonnes, 121 contraintes,
-- 120 index, 12 déclencheurs, 14 politiques, 5 fonctions, 2 types).
--
-- Périmètre : schéma public. Rien dans storage (aucune politique), pas de
-- publication realtime, pas de pg_cron ni de webhook de base, Supabase Auth
-- inutilisé. Les droits (anon, authenticated, service_role) sont ceux que
-- Supabase accorde par défaut : aucun GRANT à rejouer.
--
-- Au Gabon, ce fichier est DÉJÀ appliqué : ne jamais le rejouer. Il doit
-- être marqué « applied » dans l'historique (voir docs/multi-country/05-supabase.md).
-- ================================================================

-- Extensions (hors celles installées d'office par Supabase : pgcrypto, uuid-ossp,
-- pg_stat_statements dans « extensions », supabase_vault dans « vault »).
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- Types
CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');
CREATE TYPE public.request_status AS ENUM ('draft', 'submitted', 'processing', 'quoted', 'completed');

-- Fonctions (déclencheurs updated_at)
CREATE OR REPLACE FUNCTION public.freight_requests_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.leads_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_offers_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.youtube_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;
CREATE TABLE public.admin_collaborators (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  name text DEFAULT ''::text,
  role text DEFAULT 'admin'::text NOT NULL,
  status text DEFAULT 'invited'::text NOT NULL,
  invited_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone,
  CONSTRAINT admin_collaborators_pkey PRIMARY KEY (id),
  CONSTRAINT admin_collaborators_email_key UNIQUE (email),
  CONSTRAINT admin_collaborators_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'agent'::text, 'viewer'::text]))),
  CONSTRAINT admin_collaborators_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'disabled'::text])))
);

CREATE TABLE public.affiliate_offers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  affiliate_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  commission_percent numeric DEFAULT 0 NOT NULL,
  hidden_product_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  item_order jsonb,
  active boolean DEFAULT true NOT NULL,
  CONSTRAINT affiliate_offers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.affiliate_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  affiliate_id uuid,
  affiliate_offer_id uuid,
  message text NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  CONSTRAINT affiliate_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE public.affiliates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  shop_name text DEFAULT ''::text NOT NULL,
  airtel_number text,
  whatsapp_number text,
  active boolean DEFAULT true NOT NULL,
  CONSTRAINT affiliates_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agent_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agent_id uuid NOT NULL,
  order_id uuid NOT NULL,
  action text NOT NULL,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT agent_actions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agent_otps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agent_id uuid NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  attempts integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT agent_otps_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT agents_pkey PRIMARY KEY (id)
);

CREATE TABLE public.catalog (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source text DEFAULT 'taobao'::text NOT NULL,
  external_id text,
  title text NOT NULL,
  title_original text,
  description text,
  description_original text,
  price numeric(12,2) DEFAULT 0 NOT NULL,
  image_url text,
  main_image_url text,
  extra_images jsonb,
  seller text,
  product_url text,
  moq integer,
  weight numeric(10,3),
  volume numeric(10,4),
  dimensions text,
  search_count integer DEFAULT 1 NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  variants jsonb,
  has_battery boolean DEFAULT false NOT NULL,
  info_manquante text,
  dimensions_cm jsonb,
  CONSTRAINT catalog_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_source_external_id_key UNIQUE (source, external_id)
);

CREATE TABLE public.collab_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  collaborator_id uuid,
  collaborator_name text,
  action text NOT NULL,
  target_type text,
  target_id text,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT collab_actions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.collab_review_lines (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  offer_id uuid,
  offer_product_id uuid,
  offer_title text,
  title text,
  image_url text,
  product_url text,
  seller text,
  variants jsonb,
  price numeric,
  weight numeric(10,3),
  volume numeric(10,4),
  dimensions text,
  supplier_shipping_price numeric,
  delivery_time text,
  has_battery boolean,
  moq integer,
  collab_notes text,
  admin_note text,
  review_status text DEFAULT 'pending'::text NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  applied_at timestamp with time zone,
  vendor_filled_at timestamp with time zone,
  title_original text,
  CONSTRAINT collab_review_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE public.collaborators (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  username text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_login_at timestamp with time zone,
  role text DEFAULT 'production'::text NOT NULL,
  default_locale text DEFAULT 'fr'::text NOT NULL,
  CONSTRAINT collaborators_pkey PRIMARY KEY (id),
  CONSTRAINT collaborators_username_key UNIQUE (username),
  CONSTRAINT collaborators_default_locale_check CHECK ((default_locale = ANY (ARRAY['fr'::text, 'zh'::text]))),
  CONSTRAINT collaborators_role_check CHECK ((role = ANY (ARRAY['production'::text, 'commandes'::text, 'sourcing'::text])))
);

CREATE TABLE public.factories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  dossier_id uuid NOT NULL,
  rang integer,
  nom_cn text,
  nom_fr text,
  boutique text,
  specialite text,
  statut text,
  labels_1688 jsonb DEFAULT '[]'::jsonb NOT NULL,
  distinctions jsonb DEFAULT '[]'::jsonb NOT NULL,
  activite_30j jsonb DEFAULT '{}'::jsonb NOT NULL,
  qualite jsonb DEFAULT '{}'::jsonb NOT NULL,
  fiche_retenue jsonb,
  cree_en integer,
  anciennete_ans integer,
  atelier_m2 integer,
  effectif text,
  credit_1688 text,
  credit_rang smallint,
  note_service numeric,
  reachat text,
  reachat_pct numeric,
  abonnes text,
  ventes_90j text,
  meilleure_fiche text,
  pourquoi text,
  reserve text,
  raw jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT factories_pkey PRIMARY KEY (id)
);

CREATE TABLE public.factory_dossiers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  label text NOT NULL,
  objet text,
  perimetre_arbitre text,
  marche_cible text,
  devise text,
  methode text,
  classement text,
  repere_de_prix text,
  genere_le timestamp with time zone,
  bassins jsonb DEFAULT '{}'::jsonb NOT NULL,
  ecartes jsonb DEFAULT '[]'::jsonb NOT NULL,
  a_demander jsonb DEFAULT '[]'::jsonb NOT NULL,
  payload jsonb NOT NULL,
  factory_count integer DEFAULT 0 NOT NULL,
  ecarte_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT factory_dossiers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.freight_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  client_name text DEFAULT ''::text NOT NULL,
  client_email text DEFAULT ''::text NOT NULL,
  client_phone text DEFAULT ''::text NOT NULL,
  mode text DEFAULT 'sea'::text NOT NULL,
  sea_service text,
  origin text DEFAULT 'Chine'::text NOT NULL,
  destination text DEFAULT ''::text NOT NULL,
  weight numeric DEFAULT 0,
  volume numeric DEFAULT 0,
  goods_nature text DEFAULT ''::text,
  goods_description text DEFAULT ''::text,
  photos jsonb DEFAULT '[]'::jsonb NOT NULL,
  estimated_price numeric DEFAULT 0,
  estimated_days integer DEFAULT 0,
  status text DEFAULT 'draft'::text NOT NULL,
  admin_notes text,
  supplier_name text DEFAULT ''::text,
  supplier_address text DEFAULT ''::text,
  supplier_wechat text DEFAULT ''::text,
  quote_pricing_mode text DEFAULT 'auto'::text,
  quote_base_price numeric DEFAULT 0,
  quote_service_fee numeric DEFAULT 0,
  quote_customs_fee numeric DEFAULT 0,
  quote_other_fees jsonb DEFAULT '[]'::jsonb NOT NULL,
  quote_total numeric DEFAULT 0,
  quote_currency text DEFAULT 'USD'::text,
  quote_transit_days integer DEFAULT 0,
  quote_terms text DEFAULT ''::text,
  quote_payment_link text DEFAULT ''::text,
  quote_sent_at timestamp with time zone,
  quote_paid_at timestamp with time zone,
  client_decision text,
  client_decision_at timestamp with time zone,
  client_message text,
  CONSTRAINT freight_requests_pkey PRIMARY KEY (id),
  CONSTRAINT freight_requests_client_decision_check CHECK (((client_decision IS NULL) OR (client_decision = ANY (ARRAY['accepted'::text, 'changes_requested'::text])))),
  CONSTRAINT freight_requests_mode_check CHECK ((mode = ANY (ARRAY['sea'::text, 'air'::text]))),
  CONSTRAINT freight_requests_quote_pricing_mode_check CHECK ((quote_pricing_mode = ANY (ARRAY['auto'::text, 'manual'::text]))),
  CONSTRAINT freight_requests_sea_service_check CHECK (((sea_service IS NULL) OR (sea_service = ANY (ARRAY['lcl'::text, 'fcl20'::text, 'fcl40'::text])))),
  CONSTRAINT freight_requests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'processing'::text, 'quoted'::text, 'completed'::text, 'cancelled'::text])))
);

CREATE TABLE public.item_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_item_id uuid NOT NULL,
  author text DEFAULT 'admin'::text NOT NULL,
  message text,
  media_urls jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT item_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text NOT NULL,
  fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  admin_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  attribution jsonb,
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text]))),
  CONSTRAINT leads_type_check CHECK ((type = ANY (ARRAY['freight_estimate'::text, 'sampling'::text, 'quick_quote'::text, 'cars_import'::text, 'delegation'::text, 'youtube_shop'::text])))
);
CREATE TABLE public.offer_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  offer_id uuid NOT NULL,
  image_url text,
  description text,
  "position" integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  processed boolean DEFAULT true NOT NULL,
  added_by text DEFAULT 'admin'::text NOT NULL,
  phase_id uuid,
  CONSTRAINT offer_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.offer_order_lines (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid,
  variant_id text,
  variant_name text,
  unit_price_cny numeric NOT NULL,
  unit_price_fcfa numeric,
  quantity integer DEFAULT 1 NOT NULL,
  subtotal_cny numeric NOT NULL,
  subtotal_fcfa numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  product_title text,
  product_image text,
  product_url text,
  price_type text,
  CONSTRAINT offer_order_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE public.offer_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  offer_id uuid NOT NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  client_email text,
  transport_mode text,
  transport_cost numeric,
  items_total_cny numeric DEFAULT 0 NOT NULL,
  items_total_fcfa numeric DEFAULT 0 NOT NULL,
  total_weight numeric,
  total_volume numeric,
  has_battery boolean DEFAULT false NOT NULL,
  grand_total_fcfa numeric DEFAULT 0 NOT NULL,
  payment_status text DEFAULT 'pending'::text NOT NULL,
  ebilling_reference text,
  status text DEFAULT 'cart'::text NOT NULL,
  request_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  payment_method text,
  payment_proof_url text,
  order_status text DEFAULT 'unpaid'::text NOT NULL,
  affiliate_offer_id uuid,
  affiliate_id uuid,
  commission_fcfa numeric,
  cash_reminded_at timestamp with time zone,
  cash_collected_by uuid,
  cash_collected_at timestamp with time zone,
  internal_note text,
  parcel_photos jsonb DEFAULT '[]'::jsonb NOT NULL,
  promo_id uuid,
  promo_code text,
  promo_kind text,
  promo_discount_fcfa numeric DEFAULT 0 NOT NULL,
  promo_rate numeric,
  promo_attempts integer DEFAULT 0 NOT NULL,
  CONSTRAINT offer_orders_pkey PRIMARY KEY (id)
);

CREATE TABLE public.offer_phases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  offer_id uuid NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  CONSTRAINT offer_phases_pkey PRIMARY KEY (id)
);

CREATE TABLE public.offer_products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  offer_item_id uuid NOT NULL,
  source text DEFAULT 'manual'::text NOT NULL,
  title text NOT NULL,
  title_original text,
  description text,
  price numeric DEFAULT 0,
  image_url text,
  main_image_url text,
  extra_images jsonb,
  variants jsonb,
  seller text,
  product_url text,
  moq integer,
  weight numeric,
  volume numeric,
  dimensions text,
  has_battery boolean DEFAULT false NOT NULL,
  margin_percent numeric DEFAULT 0 NOT NULL,
  selected boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  client_quantity integer,
  client_selected boolean,
  client_variant_id text,
  taobao_item_id text DEFAULT ''::text,
  info_manquante text,
  dimensions_cm jsonb,
  videos jsonb,
  price_tiers jsonb,
  detail_images jsonb,
  variants_total integer,
  description_source text,
  supplier_shipping_price numeric,
  delivery_time text,
  review_state text,
  description_admin text,
  in_cover_video boolean DEFAULT false NOT NULL,
  price_type text,
  price_note text,
  estimation jsonb,
  CONSTRAINT offer_products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.offers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  theme text,
  description text,
  status text DEFAULT 'draft'::text NOT NULL,
  slug text,
  cover_image_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  marche_cible text,
  tri text,
  mode text,
  note text,
  quality jsonb,
  offer_currency text DEFAULT 'XAF'::text NOT NULL,
  offer_type text DEFAULT 'b2c'::text NOT NULL,
  cover_video_url text,
  mobile_video_url text,
  specs_coverage jsonb,
  archived_at timestamp with time zone,
  best_sellers jsonb DEFAULT '{"title": null, "enabled": false, "product_ids": []}'::jsonb NOT NULL,
  CONSTRAINT offers_pkey PRIMARY KEY (id),
  CONSTRAINT offers_slug_key UNIQUE (slug),
  CONSTRAINT offers_offer_currency_check CHECK ((offer_currency = ANY (ARRAY['CNY'::text, 'USD'::text, 'EUR'::text, 'XAF'::text]))),
  CONSTRAINT offers_offer_type_check CHECK ((offer_type = ANY (ARRAY['b2c'::text, 'b2b'::text])))
);

CREATE TABLE public.order_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid NOT NULL,
  author text DEFAULT 'collaborateur'::text NOT NULL,
  message text NOT NULL,
  source_lang text DEFAULT 'fr'::text NOT NULL,
  message_en text,
  message_zh text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT order_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.playbook_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ritual text NOT NULL,
  note text,
  done_by text,
  done_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT playbook_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.promo_codes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  label text,
  kind text NOT NULL,
  value numeric NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  max_uses integer,
  max_uses_per_phone integer DEFAULT 1 NOT NULL,
  client_phone text,
  min_items_fcfa numeric,
  active boolean DEFAULT true NOT NULL,
  notes text,
  created_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT promo_codes_code_key UNIQUE (code),
  CONSTRAINT promo_codes_kind_check CHECK ((kind = ANY (ARRAY['items_percent'::text, 'items_fixed'::text, 'air_rate'::text, 'sea_rate'::text]))),
  CONSTRAINT promo_codes_max_uses_check CHECK (((max_uses IS NULL) OR (max_uses > 0))),
  CONSTRAINT promo_codes_max_uses_per_phone_check CHECK ((max_uses_per_phone > 0)),
  CONSTRAINT promo_codes_min_items_fcfa_check CHECK (((min_items_fcfa IS NULL) OR (min_items_fcfa >= (0)::numeric))),
  CONSTRAINT promo_codes_value_check CHECK ((value >= (0)::numeric))
);

CREATE TABLE public.promo_uses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  promo_id uuid NOT NULL,
  order_id uuid NOT NULL,
  client_phone text,
  discount_fcfa numeric DEFAULT 0 NOT NULL,
  status text DEFAULT 'reserved'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  confirmed_at timestamp with time zone,
  CONSTRAINT promo_uses_pkey PRIMARY KEY (id),
  CONSTRAINT promo_uses_order_id_key UNIQUE (order_id),
  CONSTRAINT promo_uses_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'confirmed'::text, 'released'::text])))
);

CREATE TABLE public.quotes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  total_amount numeric(14,2) DEFAULT 0 NOT NULL,
  margin_global numeric(5,2) DEFAULT 0 NOT NULL,
  status quote_status DEFAULT 'draft'::quote_status NOT NULL,
  pdf_url text,
  document_type text DEFAULT 'devis'::text NOT NULL,
  CONSTRAINT quotes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.request_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid NOT NULL,
  image_url text,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  processed boolean DEFAULT false NOT NULL,
  added_by text DEFAULT 'client'::text NOT NULL,
  client_note text,
  CONSTRAINT request_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  client_name text DEFAULT ''::text NOT NULL,
  client_email text DEFAULT ''::text NOT NULL,
  client_phone text DEFAULT ''::text NOT NULL,
  status request_status DEFAULT 'draft'::request_status NOT NULL,
  notes text,
  proposal_currency text DEFAULT 'CNY'::text NOT NULL,
  destination text,
  final_quote_id uuid,
  CONSTRAINT requests_pkey PRIMARY KEY (id),
  CONSTRAINT requests_proposal_currency_check CHECK ((proposal_currency = ANY (ARRAY['CNY'::text, 'USD'::text, 'EUR'::text, 'XAF'::text])))
);

CREATE TABLE public.search_results (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_item_id uuid NOT NULL,
  taobao_item_id text NOT NULL,
  title text NOT NULL,
  price numeric(12,2) DEFAULT 0 NOT NULL,
  image_url text NOT NULL,
  seller text,
  product_url text DEFAULT ''::text NOT NULL,
  selected boolean DEFAULT false NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  margin_percent numeric(5,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  source text DEFAULT 'taobao'::text NOT NULL,
  title_original text,
  description text,
  moq integer,
  weight numeric(10,3),
  volume numeric(10,4),
  dimensions text,
  client_quantity integer,
  main_image_url text,
  client_selected boolean,
  extra_images jsonb,
  description_original text,
  catalog_id uuid,
  variants jsonb,
  client_variant_id text,
  has_battery boolean DEFAULT false NOT NULL,
  info_manquante text,
  dimensions_cm jsonb,
  videos jsonb,
  supplier_shipping_price numeric,
  delivery_time text,
  description_admin text,
  CONSTRAINT search_results_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sourcing_conditions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  title text NOT NULL,
  detail text,
  state text,
  resolved_on date,
  evidence text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sourcing_conditions_pkey PRIMARY KEY (id),
  CONSTRAINT sourcing_conditions_state_check CHECK ((state = ANY (ARRAY['oui'::text, 'non'::text, 'na'::text])))
);

CREATE TABLE public.sourcing_contact_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  supplier_id uuid,
  happened_on date,
  channel text,
  contact_name text,
  subject text,
  outcome text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sourcing_contact_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sourcing_images (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  supplier_id uuid,
  filename text NOT NULL,
  storage_key text NOT NULL,
  mime text,
  bytes integer,
  width integer,
  height integer,
  caption text,
  "position" integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sourcing_images_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sourcing_projects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  client text,
  buyer text,
  status text DEFAULT 'draft'::text NOT NULL,
  spec jsonb DEFAULT '{}'::jsonb NOT NULL,
  market_finding jsonb DEFAULT '{}'::jsonb NOT NULL,
  params jsonb DEFAULT '{"fx": {"CNY": 0.128, "EUR": 1, "INR": 0.0105, "MYR": 0.20, "THB": 0.026, "TWD": 0.029, "USD": 0.92, "VND": 0.000036}, "qty": 5000, "vat_pct": 18, "duty_pct": 20, "insurance_pct": 0.4, "freight_rate_eur_m3": 180}'::jsonb NOT NULL,
  weights jsonb DEFAULT '{"moq": 10, "conf": 20, "cost": 15, "lead": 10, "solid": 15, "twist": 30}'::jsonb NOT NULL,
  decision jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sourcing_projects_pkey PRIMARY KEY (id),
  CONSTRAINT sourcing_projects_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'decided'::text, 'archived'::text])))
);

CREATE TABLE public.sourcing_quotes (
  supplier_id uuid NOT NULL,
  status text DEFAULT 'a_contacter'::text NOT NULL,
  contact_name text,
  channel text,
  sent_at date,
  replied_at date,
  twist_lock text,
  twist_proof text,
  dfm_notes text,
  currency text,
  price_5k numeric,
  price_10k numeric,
  price_20k numeric,
  moq integer,
  mould_plate_cost numeric,
  mould_lid_cost numeric,
  cavities text,
  mould_life_cycles integer,
  mould_ownership text,
  sample_cost numeric,
  sample_days integer,
  tooling_days integer,
  production_days integer,
  sets_per_carton integer,
  carton_volume_m3 numeric,
  carton_weight_kg numeric,
  port text,
  incoterm text,
  cert_fda boolean DEFAULT false NOT NULL,
  cert_lfgb boolean DEFAULT false NOT NULL,
  cert_iso boolean DEFAULT false NOT NULL,
  cert_migration boolean DEFAULT false NOT NULL,
  payment_terms text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sourcing_quotes_pkey PRIMARY KEY (supplier_id),
  CONSTRAINT sourcing_quotes_mould_ownership_check CHECK ((mould_ownership = ANY (ARRAY['acheteur'::text, 'usine'::text, 'partagee'::text]))),
  CONSTRAINT sourcing_quotes_status_check CHECK ((status = ANY (ARRAY['a_contacter'::text, 'contacte'::text, 'relance'::text, 'a_repondu'::text, 'a_refuse'::text, 'ecarte'::text]))),
  CONSTRAINT sourcing_quotes_twist_lock_check CHECK ((twist_lock = ANY (ARRAY['refus'::text, 'etude'::text, 'oui_decl'::text, 'oui_photo'::text, 'oui_ref'::text])))
);

CREATE TABLE public.sourcing_shares (
  token text NOT NULL,
  project_id uuid NOT NULL,
  label text,
  reveal_winner boolean DEFAULT false NOT NULL,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  views integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sourcing_shares_pkey PRIMARY KEY (token)
);

CREATE TABLE public.sourcing_suppliers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  ext_id text,
  "position" integer DEFAULT 0 NOT NULL,
  name text NOT NULL,
  legal_name text,
  registration text,
  country text,
  track text,
  verdict text,
  verdict_label text,
  strengths text,
  weaknesses text,
  warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
  contacts jsonb DEFAULT '[]'::jsonb NOT NULL,
  default_currency text,
  known_moq integer,
  solidity integer,
  included boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sourcing_suppliers_pkey PRIMARY KEY (id),
  CONSTRAINT sourcing_suppliers_solidity_check CHECK (((solidity >= 0) AND (solidity <= 100))),
  CONSTRAINT sourcing_suppliers_track_check CHECK ((track = ANY (ARRAY['A'::text, 'B'::text]))),
  CONSTRAINT sourcing_suppliers_verdict_check CHECK ((verdict = ANY (ARRAY['green'::text, 'amber'::text, 'grey'::text, 'red'::text])))
);
CREATE TABLE public.wa_catalog_collections (
  offer_id uuid NOT NULL,
  wa_collection_id text,
  name text,
  synced_at timestamp with time zone DEFAULT now() NOT NULL,
  item_id text DEFAULT ''::text NOT NULL,
  CONSTRAINT wa_catalog_collections_pkey PRIMARY KEY (offer_id, item_id)
);

CREATE TABLE public.wa_catalog_products (
  product_id text NOT NULL,
  offer_id uuid NOT NULL,
  wa_product_id text NOT NULL,
  synced_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT wa_catalog_products_pkey PRIMARY KEY (product_id)
);

CREATE TABLE public.wa_conversations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  chat_id text NOT NULL,
  phone text NOT NULL,
  name text,
  status text DEFAULT 'open'::text NOT NULL,
  unread_count integer DEFAULT 0 NOT NULL,
  last_message_at timestamp with time zone,
  last_message_preview text,
  last_inbound_at timestamp with time zone,
  last_outbound_at timestamp with time zone,
  assigned_to text,
  assigned_name text,
  assigned_at timestamp with time zone,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_outbound_status text,
  source jsonb,
  CONSTRAINT wa_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT wa_conversations_chat_id_key UNIQUE (chat_id)
);

CREATE TABLE public.wa_departures (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  kind text NOT NULL,
  label text NOT NULL,
  departure_date date,
  cutoff_date date,
  group_id text,
  invite_link text,
  status text DEFAULT 'open'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT wa_departures_pkey PRIMARY KEY (id),
  CONSTRAINT wa_departures_kind_check CHECK ((kind = ANY (ARRAY['air'::text, 'sea'::text]))),
  CONSTRAINT wa_departures_status_check CHECK ((status = ANY (ARRAY['open'::text, 'cutoff'::text, 'loaded'::text, 'transit'::text, 'arrived'::text, 'closed'::text])))
);

CREATE TABLE public.wa_messages (
  id text NOT NULL,
  conversation_id uuid NOT NULL,
  chat_id text NOT NULL,
  from_me boolean DEFAULT false NOT NULL,
  type text NOT NULL,
  text text,
  media_url text,
  media_kind text,
  filename text,
  sender_name text,
  sent_by text,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  status text,
  status_at timestamp with time zone,
  context jsonb,
  CONSTRAINT wa_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE public.wa_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT wa_settings_pkey PRIMARY KEY (key)
);

CREATE TABLE public.whapi_polls (
  id text NOT NULL,
  chat_id text,
  title text,
  results jsonb,
  total_votes integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT whapi_polls_pkey PRIMARY KEY (id)
);

CREATE TABLE public.youtube_video_products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  video_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  name text DEFAULT ''::text NOT NULL,
  price_usd numeric DEFAULT 0,
  image_url text DEFAULT ''::text,
  product_url text DEFAULT ''::text,
  description text DEFAULT ''::text,
  order_index integer DEFAULT 0 NOT NULL,
  in_stock boolean DEFAULT true NOT NULL,
  CONSTRAINT youtube_video_products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.youtube_videos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  description text DEFAULT ''::text,
  video_type text DEFAULT 'youtube'::text NOT NULL,
  video_url text DEFAULT ''::text NOT NULL,
  youtube_id text,
  thumbnail_url text DEFAULT ''::text,
  duration text DEFAULT ''::text,
  views text DEFAULT ''::text,
  order_index integer DEFAULT 0 NOT NULL,
  published boolean DEFAULT true NOT NULL,
  CONSTRAINT youtube_videos_pkey PRIMARY KEY (id),
  CONSTRAINT youtube_videos_video_type_check CHECK ((video_type = ANY (ARRAY['youtube'::text, 'upload'::text])))
);
-- Clés étrangères
ALTER TABLE ONLY affiliate_offers ADD CONSTRAINT affiliate_offers_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE;
ALTER TABLE ONLY affiliate_offers ADD CONSTRAINT affiliate_offers_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;
ALTER TABLE ONLY affiliate_requests ADD CONSTRAINT affiliate_requests_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE;
ALTER TABLE ONLY agent_actions ADD CONSTRAINT agent_actions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE ONLY agent_actions ADD CONSTRAINT agent_actions_order_id_fkey FOREIGN KEY (order_id) REFERENCES offer_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY agent_otps ADD CONSTRAINT agent_otps_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE ONLY collab_review_lines ADD CONSTRAINT collab_review_lines_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE ONLY collab_review_lines ADD CONSTRAINT collab_review_lines_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES collaborators(id) ON DELETE SET NULL;
ALTER TABLE ONLY factories ADD CONSTRAINT factories_dossier_id_fkey FOREIGN KEY (dossier_id) REFERENCES factory_dossiers(id) ON DELETE CASCADE;
ALTER TABLE ONLY item_notes ADD CONSTRAINT item_notes_request_item_id_fkey FOREIGN KEY (request_item_id) REFERENCES request_items(id) ON DELETE CASCADE;
ALTER TABLE ONLY offer_items ADD CONSTRAINT offer_items_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;
ALTER TABLE ONLY offer_items ADD CONSTRAINT offer_items_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES offer_phases(id) ON DELETE SET NULL;
ALTER TABLE ONLY offer_order_lines ADD CONSTRAINT offer_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES offer_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY offer_order_lines ADD CONSTRAINT offer_order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES offer_products(id) ON DELETE SET NULL;
ALTER TABLE ONLY offer_orders ADD CONSTRAINT offer_orders_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE SET NULL;
ALTER TABLE ONLY offer_orders ADD CONSTRAINT offer_orders_affiliate_offer_id_fkey FOREIGN KEY (affiliate_offer_id) REFERENCES affiliate_offers(id) ON DELETE SET NULL;
ALTER TABLE ONLY offer_orders ADD CONSTRAINT offer_orders_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE ONLY offer_orders ADD CONSTRAINT offer_orders_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES promo_codes(id) ON DELETE SET NULL;
ALTER TABLE ONLY offer_orders ADD CONSTRAINT offer_orders_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL;
ALTER TABLE ONLY offer_phases ADD CONSTRAINT offer_phases_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;
ALTER TABLE ONLY offer_products ADD CONSTRAINT offer_products_offer_item_id_fkey FOREIGN KEY (offer_item_id) REFERENCES offer_items(id) ON DELETE CASCADE;
ALTER TABLE ONLY order_notes ADD CONSTRAINT order_notes_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY promo_uses ADD CONSTRAINT promo_uses_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES promo_codes(id) ON DELETE CASCADE;
ALTER TABLE ONLY quotes ADD CONSTRAINT quotes_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY request_items ADD CONSTRAINT request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY search_results ADD CONSTRAINT search_results_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES catalog(id);
ALTER TABLE ONLY search_results ADD CONSTRAINT search_results_request_item_id_fkey FOREIGN KEY (request_item_id) REFERENCES request_items(id) ON DELETE CASCADE;
ALTER TABLE ONLY sourcing_conditions ADD CONSTRAINT sourcing_conditions_project_id_fkey FOREIGN KEY (project_id) REFERENCES sourcing_projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY sourcing_contact_log ADD CONSTRAINT sourcing_contact_log_project_id_fkey FOREIGN KEY (project_id) REFERENCES sourcing_projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY sourcing_contact_log ADD CONSTRAINT sourcing_contact_log_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES sourcing_suppliers(id) ON DELETE CASCADE;
ALTER TABLE ONLY sourcing_images ADD CONSTRAINT sourcing_images_project_id_fkey FOREIGN KEY (project_id) REFERENCES sourcing_projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY sourcing_images ADD CONSTRAINT sourcing_images_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES sourcing_suppliers(id) ON DELETE CASCADE;
ALTER TABLE ONLY sourcing_quotes ADD CONSTRAINT sourcing_quotes_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES sourcing_suppliers(id) ON DELETE CASCADE;
ALTER TABLE ONLY sourcing_shares ADD CONSTRAINT sourcing_shares_project_id_fkey FOREIGN KEY (project_id) REFERENCES sourcing_projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY sourcing_suppliers ADD CONSTRAINT sourcing_suppliers_project_id_fkey FOREIGN KEY (project_id) REFERENCES sourcing_projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY wa_messages ADD CONSTRAINT wa_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE;
ALTER TABLE ONLY youtube_video_products ADD CONSTRAINT youtube_video_products_video_id_fkey FOREIGN KEY (video_id) REFERENCES youtube_videos(id) ON DELETE CASCADE;

-- Index
CREATE INDEX idx_admin_collaborators_email ON public.admin_collaborators USING btree (email);
CREATE INDEX idx_admin_collaborators_status ON public.admin_collaborators USING btree (status);
CREATE INDEX idx_affiliate_offers_offer ON public.affiliate_offers USING btree (offer_id);
CREATE INDEX agent_actions_order_idx ON public.agent_actions USING btree (order_id, created_at DESC);
CREATE INDEX agent_otps_agent_idx ON public.agent_otps USING btree (agent_id, created_at DESC);
CREATE UNIQUE INDEX agents_phone_key ON public.agents USING btree (phone);
CREATE INDEX idx_catalog_description_trgm ON public.catalog USING gin (description gin_trgm_ops);
CREATE INDEX idx_catalog_external_id ON public.catalog USING btree (external_id);
CREATE INDEX idx_catalog_price ON public.catalog USING btree (price);
CREATE INDEX idx_catalog_search_count ON public.catalog USING btree (search_count DESC);
CREATE INDEX idx_catalog_seller_trgm ON public.catalog USING gin (seller gin_trgm_ops);
CREATE INDEX idx_catalog_source ON public.catalog USING btree (source);
CREATE INDEX idx_catalog_source_price ON public.catalog USING btree (source, price);
CREATE INDEX idx_catalog_title_original_trgm ON public.catalog USING gin (title_original gin_trgm_ops);
CREATE INDEX idx_catalog_title_trgm ON public.catalog USING gin (title gin_trgm_ops);
CREATE INDEX collab_actions_collab_idx ON public.collab_actions USING btree (collaborator_id, created_at DESC);
CREATE INDEX collab_actions_created_idx ON public.collab_actions USING btree (created_at DESC);
CREATE INDEX idx_collab_review_offer ON public.collab_review_lines USING btree (offer_id);
CREATE INDEX idx_collab_review_status ON public.collab_review_lines USING btree (review_status);
CREATE INDEX factories_dossier_idx ON public.factories USING btree (dossier_id, rang);
CREATE INDEX factory_dossiers_created_idx ON public.factory_dossiers USING btree (created_at DESC);
CREATE INDEX idx_freight_requests_created_at ON public.freight_requests USING btree (created_at DESC);
CREATE INDEX idx_freight_requests_status ON public.freight_requests USING btree (status);
CREATE INDEX idx_item_notes_request_item_id ON public.item_notes USING btree (request_item_id);
CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);
CREATE INDEX idx_leads_status ON public.leads USING btree (status);
CREATE INDEX idx_leads_status_created ON public.leads USING btree (status, created_at DESC);
CREATE INDEX idx_leads_type ON public.leads USING btree (type);
CREATE INDEX idx_leads_utm_campaign ON public.leads USING btree ((((attribution -> 'last'::text) ->> 'utm_campaign'::text))) WHERE (attribution IS NOT NULL);
CREATE INDEX idx_leads_utm_source ON public.leads USING btree ((((attribution -> 'last'::text) ->> 'utm_source'::text))) WHERE (attribution IS NOT NULL);
CREATE INDEX idx_offer_items_offer ON public.offer_items USING btree (offer_id, "position");
CREATE INDEX idx_offer_order_lines_order ON public.offer_order_lines USING btree (order_id);
CREATE INDEX idx_offer_orders_offer ON public.offer_orders USING btree (offer_id, created_at DESC);
CREATE INDEX idx_offer_phases_offer ON public.offer_phases USING btree (offer_id, "position");
CREATE INDEX idx_offer_products_item ON public.offer_products USING btree (offer_item_id, "position");
CREATE INDEX idx_offer_products_item_pos ON public.offer_products USING btree (offer_item_id, "position");
CREATE INDEX offers_archived_idx ON public.offers USING btree (archived_at DESC) WHERE (archived_at IS NOT NULL);
CREATE INDEX order_notes_request_id_idx ON public.order_notes USING btree (request_id, created_at DESC);
CREATE INDEX playbook_log_ritual_idx ON public.playbook_log USING btree (ritual, done_at DESC);
CREATE INDEX promo_codes_active_idx ON public.promo_codes USING btree (active, ends_at);
CREATE INDEX promo_uses_phone_idx ON public.promo_uses USING btree (promo_id, client_phone) WHERE (status <> 'released'::text);
CREATE INDEX promo_uses_promo_idx ON public.promo_uses USING btree (promo_id, status);
CREATE INDEX idx_quotes_request_id ON public.quotes USING btree (request_id);
CREATE INDEX idx_request_items_processed ON public.request_items USING btree (processed);
CREATE INDEX idx_request_items_request_id ON public.request_items USING btree (request_id);
CREATE INDEX idx_search_results_request_item_id ON public.search_results USING btree (request_item_id);
CREATE INDEX idx_search_results_source ON public.search_results USING btree (source);
CREATE INDEX sourcing_conditions_project_idx ON public.sourcing_conditions USING btree (project_id, "position");
CREATE INDEX sourcing_contact_log_project_idx ON public.sourcing_contact_log USING btree (project_id, happened_on DESC);
CREATE INDEX sourcing_images_project_idx ON public.sourcing_images USING btree (project_id, "position");
CREATE INDEX sourcing_images_supplier_idx ON public.sourcing_images USING btree (supplier_id);
CREATE UNIQUE INDEX sourcing_projects_slug_key ON public.sourcing_projects USING btree (slug);
CREATE INDEX sourcing_projects_status_idx ON public.sourcing_projects USING btree (status, updated_at DESC);
CREATE INDEX sourcing_shares_project_idx ON public.sourcing_shares USING btree (project_id, created_at DESC);
CREATE UNIQUE INDEX sourcing_suppliers_project_ext_key ON public.sourcing_suppliers USING btree (project_id, ext_id) WHERE (ext_id IS NOT NULL);
CREATE INDEX sourcing_suppliers_project_idx ON public.sourcing_suppliers USING btree (project_id, "position");
CREATE INDEX wa_catalog_collections_offer_idx ON public.wa_catalog_collections USING btree (offer_id);
CREATE INDEX wa_catalog_products_offer_idx ON public.wa_catalog_products USING btree (offer_id);
CREATE INDEX wa_conversations_assigned_idx ON public.wa_conversations USING btree (assigned_to, last_message_at DESC);
CREATE INDEX wa_conversations_status_idx ON public.wa_conversations USING btree (status, last_message_at DESC);
CREATE INDEX wa_departures_status_idx ON public.wa_departures USING btree (status, departure_date DESC);
CREATE INDEX wa_messages_conversation_idx ON public.wa_messages USING btree (conversation_id, sent_at);
CREATE INDEX whapi_polls_updated_idx ON public.whapi_polls USING btree (updated_at DESC);
CREATE INDEX idx_yt_products_order ON public.youtube_video_products USING btree (video_id, order_index);
CREATE INDEX idx_yt_products_video ON public.youtube_video_products USING btree (video_id);
CREATE INDEX idx_youtube_videos_order ON public.youtube_videos USING btree (order_index);
CREATE INDEX idx_youtube_videos_published ON public.youtube_videos USING btree (published);

-- Déclencheurs
CREATE TRIGGER trigger_catalog_updated_at BEFORE UPDATE ON public.catalog FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER freight_requests_updated_at BEFORE UPDATE ON public.freight_requests FOR EACH ROW EXECUTE FUNCTION freight_requests_set_updated_at();
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION leads_set_updated_at();
CREATE TRIGGER trg_offer_orders_touch BEFORE UPDATE ON public.offer_orders FOR EACH ROW EXECUTE FUNCTION touch_offers_updated_at();
CREATE TRIGGER trg_offers_touch BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION touch_offers_updated_at();
CREATE TRIGGER trigger_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_sourcing_conditions_updated_at BEFORE UPDATE ON public.sourcing_conditions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_sourcing_projects_updated_at BEFORE UPDATE ON public.sourcing_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_sourcing_quotes_updated_at BEFORE UPDATE ON public.sourcing_quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_sourcing_suppliers_updated_at BEFORE UPDATE ON public.sourcing_suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER youtube_products_updated_at BEFORE UPDATE ON public.youtube_video_products FOR EACH ROW EXECUTE FUNCTION youtube_set_updated_at();
CREATE TRIGGER youtube_videos_updated_at BEFORE UPDATE ON public.youtube_videos FOR EACH ROW EXECUTE FUNCTION youtube_set_updated_at();
-- Sécurité au niveau des lignes (état du Gabon au 24 septembre 2026).
-- Attention : offers, offer_items, offer_orders, offer_order_lines et
-- offer_products n'ont PAS la RLS au Gabon. Voir la migration de durcissement
-- 20260924000100_rls_offer_tables.sql.
ALTER TABLE public.admin_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_review_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_contact_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_catalog_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whapi_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_video_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;

-- Politiques
CREATE POLICY "Catalog delete" ON public.catalog AS PERMISSIVE FOR DELETE TO public USING (true);
CREATE POLICY "Catalog insert" ON public.catalog AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Catalog is readable" ON public.catalog AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Catalog update" ON public.catalog AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can add item notes" ON public.item_notes AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can delete item notes" ON public.item_notes AS PERMISSIVE FOR DELETE TO public USING (true);
CREATE POLICY "Item notes are readable" ON public.item_notes AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Quotes are readable" ON public.quotes AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can add request items" ON public.request_items AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Request items are readable" ON public.request_items AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create a request" ON public.requests AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update a request" ON public.requests AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Requests are readable by anyone with the UUID" ON public.requests AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Search results are readable" ON public.search_results AS PERMISSIVE FOR SELECT TO public USING (true);

-- Commentaires
COMMENT ON TABLE public.affiliate_offers IS 'Offre gérée en marque blanche par un affilié (commission, masquage, ordre). UUID = jeton des liens /partenaire et /b.';
COMMENT ON TABLE public.affiliates IS 'Partenaires marque blanche (boutique, Airtel Money, WhatsApp).';
COMMENT ON COLUMN public.catalog.variants IS 'Variantes catalogue: tableau JSONB de { name, price, moq, weight, volume, dimensions, capacity }';
COMMENT ON TABLE public.collab_actions IS 'Journal d''audit des actions collaborateurs (mise à jour de fiches produits).';
COMMENT ON TABLE public.collab_review_lines IS 'Lignes produit d''offre envoyées aux collaborateurs pour révision (compléter infos vendeur).';
COMMENT ON COLUMN public.collab_review_lines.vendor_filled_at IS 'Date à laquelle le vendeur a rempli la fiche partagée (lien public).';
COMMENT ON TABLE public.collaborators IS 'Comptes collaborateurs (accès restreint /offer + /request). password_hash = scrypt salt:hash.';
COMMENT ON COLUMN public.collaborators.role IS 'production = sourcing + offres + révisions (comportement historique) | commandes = commandes app uniquement | sourcing = offres B2B uniquement.';
COMMENT ON TABLE public.factories IS 'Usines d''un dossier, une ligne par atelier ; colonnes normalisées pour le tri, fiche d''origine dans raw.';
COMMENT ON COLUMN public.factories.credit_rang IS 'Note de crédit 1688 rendue triable : 3 = AAA, 2 = AA, 1 = A, NULL = non relevé.';
COMMENT ON TABLE public.factory_dossiers IS 'Dossiers « Usines » : un JSON de classement d''ateliers importé depuis /admin/usines.';
COMMENT ON COLUMN public.leads.attribution IS 'Provenance du lead : { first: TouchPoint, last: TouchPoint }. TouchPoint = utm_*, fbclid/gclid/ttclid, referrer, landing_path, at.';
COMMENT ON COLUMN public.offer_items.phase_id IS 'Phase de la catégorie (null = sans phase).';
COMMENT ON COLUMN public.offer_order_lines.product_title IS 'Nom du produit au moment de la commande (snapshot).';
COMMENT ON COLUMN public.offer_order_lines.product_image IS 'Image du produit au moment de la commande (snapshot).';
COMMENT ON COLUMN public.offer_order_lines.product_url IS 'URL marketplace (1688…) du produit au moment de la commande (snapshot).';
COMMENT ON COLUMN public.offer_orders.transport_mode IS 'air | sea | quote';
COMMENT ON COLUMN public.offer_orders.payment_status IS 'pending | paid | failed';
COMMENT ON COLUMN public.offer_orders.status IS 'cart | transport_selected | paid | shipped | cancelled';
COMMENT ON COLUMN public.offer_orders.payment_method IS 'Méthode de paiement : ebilling | airtel.';
COMMENT ON COLUMN public.offer_orders.payment_proof_url IS 'URL de la capture du virement Airtel Money (à vérifier par l''admin).';
COMMENT ON COLUMN public.offer_orders.order_status IS 'Statut de traitement : unpaid | paid | shipped | delivered.';
COMMENT ON COLUMN public.offer_orders.commission_fcfa IS 'Commission affilié (FCFA) incluse dans les prix de la commande.';
COMMENT ON COLUMN public.offer_orders.cash_reminded_at IS 'Date d''envoi de la relance de paiement cash (36h). null = pas encore relancé.';
COMMENT ON COLUMN public.offer_orders.promo_rate IS 'Tarif transport imposé par le code (FCFA/kg aérien ou FCFA/m³ maritime).';
COMMENT ON TABLE public.offer_phases IS 'Phases d''une offre (B2B) regroupant des catégories (offer_items).';
COMMENT ON COLUMN public.offer_products."position" IS 'Ordre manuel dans la catégorie (null = non ordonné → tri par fiabilité).';
COMMENT ON COLUMN public.offer_products.price_tiers IS 'Paliers de prix par quantité [{min_qty,price}] (CNY), triés par min_qty croissant. Donnée devis prioritaire.';
COMMENT ON COLUMN public.offer_products.detail_images IS 'Images de la description longue (schémas cotés, certificats, photos usine), distinctes de extra_images.';
COMMENT ON COLUMN public.offer_products.variants_total IS 'Nombre réel de SKU quand variants[] n''est qu''un échantillon représentatif (ex: 44 pour 5 listées).';
COMMENT ON COLUMN public.offer_products.description_source IS 'Mention de provenance des données. Usage INTERNE — ne jamais exposer au client final.';
COMMENT ON COLUMN public.offer_products.supplier_shipping_price IS 'INTERNE — prix livraison fournisseur jusqu''à nos dépôts en Chine (CNY). Jamais exposé au client.';
COMMENT ON COLUMN public.offer_products.delivery_time IS 'INTERNE — délai de livraison (texte). Jamais exposé au client.';
COMMENT ON COLUMN public.offer_products.review_state IS 'null | reviewed (révisée par collaborateur, en attente de validation admin → ligne bleue).';
COMMENT ON COLUMN public.offer_products.description_admin IS 'Description interne (admin/collaborateurs) — jamais montrée au client.';
COMMENT ON COLUMN public.offer_products.in_cover_video IS 'Produit présent dans la vidéo de cover — badge « Vu dans la vidéo » côté client.';
COMMENT ON COLUMN public.offers.status IS 'draft | published | closed';
COMMENT ON COLUMN public.offers.mode IS 'Mode du catalogue source (interne/public). Usage INTERNE — ne jamais exposer au client final.';
COMMENT ON COLUMN public.offers.quality IS 'Bloc qualité sourcing (compteurs + warnings). Usage INTERNE — ne jamais exposer au client final.';
COMMENT ON COLUMN public.offers.offer_currency IS 'Devise principale affichée au client sur le lien public (CNY|USD|EUR|XAF). Défaut XAF (FCFA).';
COMMENT ON COLUMN public.offers.offer_type IS 'b2c (défaut) | b2b — offres dédiées aux professionnels.';
COMMENT ON COLUMN public.offers.cover_video_url IS 'URL d''une vidéo mp4 de cover (prioritaire sur cover_image_url à l''affichage).';
COMMENT ON COLUMN public.offers.mobile_video_url IS 'Vidéo mp4 carrée (1:1) affichée en tête sur mobile (autoplay + boucle) quand l''offre est publiée.';
COMMENT ON COLUMN public.offers.archived_at IS 'Date d''archivage du listing (null = actif). Les offres archivées sortent des listes B2B/B2C et apparaissent dans la galerie /admin/archives.';
COMMENT ON COLUMN public.offers.best_sellers IS 'Galerie « Best sellers » : {enabled:boolean, product_ids:uuid[] (max 12, ordonnés), title:text|null}';
COMMENT ON TABLE public.order_notes IS 'Notes ajoutees par les collaborateurs sur la fiche /order-summary. message_en et message_zh sont des caches remplis a la demande via Kimi.';
COMMENT ON TABLE public.promo_codes IS 'Codes promo : remise articles (hors transport) ou tarif transport négocié, avec quotas et fenêtre.';
COMMENT ON TABLE public.promo_uses IS 'Usages : reserved à l''application sur la commande, confirmed au paiement, released si retiré/abandonné.';
COMMENT ON COLUMN public.requests.proposal_currency IS 'Devise principale affichee en grand sur /proposal/[uuid] : CNY | USD | EUR | XAF';
COMMENT ON COLUMN public.requests.destination IS 'Ville/pays de livraison du client (texte libre, ex: "Libreville, Gabon")';
COMMENT ON COLUMN public.requests.final_quote_id IS 'ID du devis final genere depuis /order-summary une fois toutes les infos completes. Permet d afficher un badge "Devis disponible" sur /proposal.';
COMMENT ON COLUMN public.search_results.variants IS 'Variantes du produit (manuel): tableau JSONB de { name, price, moq, weight, volume, dimensions, capacity }';
COMMENT ON COLUMN public.search_results.client_variant_id IS 'ID de la variante choisie par le client (NULL = produit de base, sans variante)';
COMMENT ON COLUMN public.search_results.has_battery IS 'Produit contient une batterie (transport/douane aerienne specifique)';
COMMENT ON COLUMN public.search_results.info_manquante IS 'Champs non confirmes par le fournisseur (texte libre, ex: "poids, cbm")';
COMMENT ON COLUMN public.search_results.dimensions_cm IS 'Dimensions detaillees { length, width, height } en cm (optionnel, complete la string dimensions existante)';
COMMENT ON COLUMN public.search_results.description_admin IS 'Description interne (admin/collaborateurs) — jamais montrée au client.';
COMMENT ON TABLE public.wa_catalog_collections IS 'Collections WhatsApp créées par catégorie de listing (offer_id + item_id).';
COMMENT ON TABLE public.whapi_polls IS 'Résultats des sondages WhatsApp, alimentés par le webhook WHAPI (messages type poll_update). Upsert par id de message.';
