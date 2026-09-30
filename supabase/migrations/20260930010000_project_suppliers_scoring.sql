-- ================================================
-- Projets › usines (30 sept. 2026) : résultats de la consultation par lot,
-- notation due diligence (5 critères /5 = /25), sélection par l'équipe, fiche
-- anonymisée montrée au client (description, caractéristiques de l'usine et
-- du produit, certifications), contacts trouvés (e-mail, WeChat, WhatsApp) et
-- messages RFQ prêts à partir (anglais + chinois) générés avec le plan.
-- L'identité et les contacts restent internes. Non destructive, idempotente.
-- ================================================
ALTER TABLE public.project_suppliers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'shortlisted', 'selected', 'rejected')),
  -- Notation /5 par critère : {certifications, tropical, installation, price, transparency}
  ADD COLUMN IF NOT EXISTS scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Visible du client (anonymisé) :
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS product_specs jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{label, value}]
  ADD COLUMN IF NOT EXISTS certifications text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS capacity text,
  ADD COLUMN IF NOT EXISTS lead_time text,
  ADD COLUMN IF NOT EXISTS moq text,
  ADD COLUMN IF NOT EXISTS sample_status text CHECK (sample_status IN ('none', 'requested', 'received', 'validated')),
  -- Interne seulement :
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS indicative_price text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS wechat text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS preferred_channel text CHECK (preferred_channel IN ('email', 'wechat', 'whatsapp', 'alibaba', 'website', 'phone')),
  ADD COLUMN IF NOT EXISTS contact_source text,      -- où le contact a été trouvé (site, Alibaba, IA…)
  ADD COLUMN IF NOT EXISTS selected_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Signature de l'expéditeur des RFQ (nom, société, WhatsApp, WeChat, e-mail).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rfq_sender jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Un message RFQ par lot : e-mail (EN) + message court (EN et ZH), modifiables.
CREATE TABLE IF NOT EXISTS public.project_rfq_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  lot text NOT NULL,
  product_en text NOT NULL DEFAULT '',
  product_zh text NOT NULL DEFAULT '',
  quantities_en text NOT NULL DEFAULT '',
  requirements_en text[] NOT NULL DEFAULT '{}',
  email_subject_en text NOT NULL DEFAULT '',
  email_body_en text NOT NULL DEFAULT '',
  short_en text NOT NULL DEFAULT '',
  short_zh text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'template' CHECK (origin IN ('template', 'ai', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, lot)
);
ALTER TABLE public.project_rfq_messages ENABLE ROW LEVEL SECURITY;
