-- ================================================
-- Onglet « Projets » (30 sept. 2026) : suivi client d'un programme
-- d'équipement clé en main (plan d'action, journal, questions, documents,
-- devis validé ligne par ligne, commandes, rapports, échanges usines).
--
-- Partie Twinsk seulement (COUNTRY.modules.twinsk) ; les tables existent dans
-- les deux pays (schéma commun) mais restent vides en Côte d'Ivoire.
-- Accès serveur uniquement (service_role) : RLS active sans politique.
-- Non destructive, idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text,
  title text NOT NULL,
  description text,
  client_name text,
  client_company text,
  client_phone text,
  client_email text,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  -- [{id, name, order, sites[], received_at}]
  phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- {transit: {site: [min,max]}, production, technician_visa, padel_slab_cure}
  durations jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_trip_interested_at timestamptz,
  business_trip_quote_requested_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Accès client : un lien à jeton par personne, révocable.
CREATE TABLE IF NOT EXISTS public.project_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  person_name text NOT NULL,
  role_label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  views integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_shares_project_idx ON public.project_shares (project_id);

CREATE TABLE IF NOT EXISTS public.project_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  key text NOT NULL,
  title text NOT NULL,
  description text,
  owner text NOT NULL DEFAULT 'team' CHECK (owner IN ('team', 'client')),
  phase text,
  due_weeks integer,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done')),
  done_at timestamptz,
  done_by text,
  -- [{id, label, done}]
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{name, url, size, kind, by, at}]
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_tasks_project_idx ON public.project_tasks (project_id, step_key, position);

CREATE TABLE IF NOT EXISTS public.project_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('team', 'client')),
  author_name text NOT NULL,
  text text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_task_comments_task_idx ON public.project_task_comments (task_id, created_at);

-- Journal du projet (une entrée attendue par jour ouvré).
CREATE TABLE IF NOT EXISTS public.project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  author_name text,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_updates_project_idx ON public.project_updates (project_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.project_update_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id uuid NOT NULL REFERENCES public.project_updates(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('team', 'client')),
  author_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Questions du client (tickets).
CREATE TABLE IF NOT EXISTS public.project_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subject text NOT NULL,
  detail text NOT NULL DEFAULT '',
  attachment jsonb,
  asked_by text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_questions_project_idx ON public.project_questions (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_question_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.project_questions(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('team', 'client')),
  author_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Documents partagés : fichiers dans le bucket PRIVÉ project-files, servis par liens signés.
CREATE TABLE IF NOT EXISTS public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'misc' CHECK (category IN ('site', 'technical', 'admin', 'reports', 'misc')),
  name text NOT NULL,
  storage_path text NOT NULL,
  mime text,
  size bigint,
  uploaded_by text NOT NULL,
  -- Documents réservés à l'équipe (jamais listés côté client).
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_documents_project_idx ON public.project_documents (project_id, category, created_at DESC);

-- Fournisseurs par lot : alias côté client, identité réelle côté équipe seulement.
CREATE TABLE IF NOT EXISTS public.project_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  lot text NOT NULL,
  alias text NOT NULL,
  real_name text,
  contact text,
  country text,
  score numeric,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_suppliers_project_idx ON public.project_suppliers (project_id, lot);

-- Échanges avec les usines (captures d'écran WeChat / e-mails / appels) : équipe seulement.
CREATE TABLE IF NOT EXISTS public.project_supplier_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.project_suppliers(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'other' CHECK (channel IN ('wechat', 'email', 'whatsapp', 'phone', 'visit', 'other')),
  exchanged_at timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL,
  -- Captures d'écran et pièces (bucket privé) : [{name, url|path, size, kind, by, at}]
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_action text,
  next_action_at timestamptz,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_supplier_exchanges_project_idx ON public.project_supplier_exchanges (project_id, exchanged_at DESC);

-- Devis consolidé : une ligne par article, validée par le client puis commandée.
CREATE TABLE IF NOT EXISTS public.project_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  lot text NOT NULL,
  label text NOT NULL,
  unit text NOT NULL DEFAULT 'pièce',
  quantity numeric NOT NULL DEFAULT 1,
  client_quantity numeric,
  unit_price numeric,
  -- Prix d'achat : jamais exposé côté client.
  unit_cost numeric,
  optional boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  phase text,
  supplier_id uuid REFERENCES public.project_suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'ordered')),
  validated_at timestamptz,
  validated_by text,
  -- Figé à la validation : {quantity, unit_price, total}
  validated_snapshot jsonb,
  order_id uuid,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_quote_lines_project_idx ON public.project_quote_lines (project_id, position);

CREATE TABLE IF NOT EXISTS public.project_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reference text NOT NULL,
  status text NOT NULL DEFAULT 'validated' CHECK (status IN ('validated', 'issued', 'deposit_secured', 'production', 'inspection', 'shipped', 'in_transit', 'delivered')),
  line_ids uuid[] NOT NULL DEFAULT '{}',
  total numeric NOT NULL DEFAULT 0,
  tracking text,
  -- Historique des statuts : [{status, at, by}]
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_orders_project_idx ON public.project_orders (project_id, created_at DESC);

-- Rapport final par phase.
CREATE TABLE IF NOT EXISTS public.project_final_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase text NOT NULL,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivered_at timestamptz,
  file_id uuid REFERENCES public.project_documents(id) ON DELETE SET NULL,
  UNIQUE (project_id, phase)
);

-- Audit et notifications : toute action tracée (qui, quoi, quand), envois marqués.
CREATE TABLE IF NOT EXISTS public.project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  actor text NOT NULL,
  actor_name text,
  target_type text,
  target_id text,
  detail text,
  data jsonb,
  -- 'client' | 'team' : qui doit être prévenu (null = simple trace).
  notify text CHECK (notify IN ('client', 'team')),
  notified_at timestamptz,
  seen_by_team_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_events_project_idx ON public.project_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_events_pending_idx ON public.project_events (notify) WHERE notified_at IS NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_update_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_question_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_supplier_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_final_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;
