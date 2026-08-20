-- ================================================
-- Twinsk — Migration #47
-- Module Sourcing fournisseurs : projets de consultation, panel fournisseurs,
-- réponses aux demandes de devis, journal de contact, conditions suspensives,
-- annexes visuelles et liens de partage public en lecture seule.
-- Idempotente. À exécuter dans le SQL Editor.
--
-- Portage de sourcing/cockpit_sourcing_assiette.html (source de vérité métier).
--
-- RÈGLE DE NULLITÉ, NON NÉGOCIABLE : tous les champs chiffrés de sourcing_quotes
-- sont nullables et sans DEFAULT. NULL = "le fournisseur n'a pas répondu".
-- Zéro est une valeur mesurée, l'absence est une information différente : les
-- deux ne doivent jamais être confondues dans un calcul ni dans un affichage.
-- ================================================

-- ------------------------------------------------
-- 1. Projets de sourcing
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS sourcing_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  client text,
  buyer text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'decided', 'archived')),

  -- Cahier des charges : diamètre, profondeur, compartimentage, couvercle,
  -- mécanisme, matière, coloris, usages, conformités visées — valeur + tolérance.
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Constat de marché : requêtes menées, résultats, références les plus proches.
  market_finding jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Paramètres de calcul. Pourcentages stockés en points (0.4 = 0,4 %), à l'identique
  -- du cockpit HTML, pour que l'aller-retour import/export reste direct.
  -- Les taux de change sont pivot EUR et vivent ici, par projet : ils doivent être
  -- actualisés le jour de l'analyse des devis, pas partagés avec le pricing produit.
  params jsonb NOT NULL DEFAULT
    '{"qty": 5000,
      "freight_rate_eur_m3": 180,
      "insurance_pct": 0.4,
      "duty_pct": 20,
      "vat_pct": 18,
      "fx": {"EUR": 1, "USD": 0.92, "CNY": 0.128, "THB": 0.026,
             "VND": 0.000036, "INR": 0.0105, "MYR": 0.20, "TWD": 0.029}}'::jsonb,

  -- Pondérations du score. Somme affichée en permanence côté cockpit ; le score
  -- est renormalisé sur les seuls critères renseignés, la somme peut donc dévier de 100.
  weights jsonb NOT NULL DEFAULT
    '{"twist": 30, "conf": 20, "solid": 15, "cost": 15, "moq": 10, "lead": 10}'::jsonb,

  -- Décision : réponse, fournisseur retenu, fournisseur de secours, date, motivation, actions.
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sourcing_projects_slug_key ON sourcing_projects (slug);
CREATE INDEX IF NOT EXISTS sourcing_projects_status_idx ON sourcing_projects (status, updated_at DESC);

-- ------------------------------------------------
-- 2. Panel fournisseurs
-- Un fournisseur appartient à un projet. Le même fabricant dans deux projets
-- = deux lignes distinctes. On duplique, on ne partage pas.
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS sourcing_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES sourcing_projects(id) ON DELETE CASCADE,

  -- Identifiant court et stable, repris du cockpit HTML (eelian, picnic, changrong...).
  -- Sert de clé pour l'amorçage idempotent et pour l'aller-retour du JSON exporté
  -- par le fichier autonome, qui indexe ses valeurs par cet identifiant.
  ext_id text,

  position int NOT NULL DEFAULT 0,
  name text NOT NULL,
  legal_name text,
  registration text,
  country text,
  track text CHECK (track IN ('A', 'B')),
  verdict text CHECK (verdict IN ('green', 'amber', 'grey', 'red')),
  verdict_label text,
  strengths text,
  weaknesses text,

  -- Alertes bloquantes issues de la due diligence : domaine sosie, entité
  -- contractante, homonyme. Ce sont des données, pas des commentaires.
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- [{label, value, note, kind}] — kind ∈ email | phone | whatsapp | wechat | url | address
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,

  default_currency text,
  known_moq int,                       -- MOQ documenté avant consultation. NULL = inconnu.
  solidity int CHECK (solidity BETWEEN 0 AND 100),
  included boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sourcing_suppliers_project_idx
  ON sourcing_suppliers (project_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS sourcing_suppliers_project_ext_key
  ON sourcing_suppliers (project_id, ext_id) WHERE ext_id IS NOT NULL;

-- ------------------------------------------------
-- 3. Réponses à la consultation (1-1 avec le fournisseur)
-- Table séparée car le cycle de vie diffère : la fiche de due diligence est
-- stable, la réponse évolue à chaque échange.
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS sourcing_quotes (
  supplier_id uuid PRIMARY KEY REFERENCES sourcing_suppliers(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'a_contacter'
    CHECK (status IN ('a_contacter', 'contacte', 'relance', 'a_repondu', 'a_refuse', 'ecarte')),
  contact_name text,
  channel text,
  sent_at date,
  replied_at date,

  -- Faisabilité twist-lock. NULL = non répondu (le cockpit HTML utilise la chaîne
  -- vide ; le pont d'import convertit dans les deux sens).
  twist_lock text
    CHECK (twist_lock IN ('refus', 'etude', 'oui_decl', 'oui_photo', 'oui_ref')),
  twist_proof text,
  dfm_notes text,

  currency text,
  price_5k numeric,
  price_10k numeric,
  price_20k numeric,
  moq int,

  mould_plate_cost numeric,
  mould_lid_cost numeric,
  cavities text,
  mould_life_cycles int,
  mould_ownership text CHECK (mould_ownership IN ('acheteur', 'usine', 'partagee')),

  sample_cost numeric,
  sample_days int,
  tooling_days int,
  production_days int,

  sets_per_carton int,
  carton_volume_m3 numeric,
  carton_weight_kg numeric,
  port text,
  incoterm text,

  -- Conformité : cocher ce qui a été REÇU (pas déclaré). 25 points par certificat.
  cert_fda boolean NOT NULL DEFAULT false,
  cert_lfgb boolean NOT NULL DEFAULT false,
  cert_iso boolean NOT NULL DEFAULT false,
  cert_migration boolean NOT NULL DEFAULT false,

  payment_terms text,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------
-- 4. Annexes visuelles
-- supplier_id NULL = annexe de projet. Les fichiers vivent dans le bucket
-- request-images sous le préfixe sourcing/ ; on ne stocke jamais de base64 ici.
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS sourcing_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES sourcing_projects(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES sourcing_suppliers(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_key text NOT NULL,
  mime text,
  bytes int,
  width int,
  height int,
  caption text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sourcing_images_project_idx
  ON sourcing_images (project_id, position);
CREATE INDEX IF NOT EXISTS sourcing_images_supplier_idx
  ON sourcing_images (supplier_id);

-- ------------------------------------------------
-- 5. Journal de contact
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS sourcing_contact_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES sourcing_projects(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES sourcing_suppliers(id) ON DELETE CASCADE,
  happened_on date,
  channel text,
  contact_name text,
  subject text,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sourcing_contact_log_project_idx
  ON sourcing_contact_log (project_id, happened_on DESC);

-- ------------------------------------------------
-- 6. Conditions suspensives (les huit, par projet)
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS sourcing_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES sourcing_projects(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  title text NOT NULL,
  detail text,
  state text CHECK (state IN ('oui', 'non', 'na')),   -- NULL = non statué
  resolved_on date,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sourcing_conditions_project_idx
  ON sourcing_conditions (project_id, position);

-- ------------------------------------------------
-- 7. Liens de partage public
-- Le jeton est généré côté application avec un CSPRNG (>= 32 caractères).
-- Un lien révoqué reste en base pour l'historique mais répond 404.
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS sourcing_shares (
  token text PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES sourcing_projects(id) ON DELETE CASCADE,
  label text,
  -- Nomme le fournisseur retenu dans la vue partagée. Faux par défaut : la
  -- décision est publiable, l'identité du retenu ne l'est pas sauf choix explicite.
  reveal_winner boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  revoked_at timestamptz,
  views int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sourcing_shares_project_idx
  ON sourcing_shares (project_id, created_at DESC);

-- ------------------------------------------------
-- Triggers updated_at (réutilise update_updated_at() du schéma initial)
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sourcing_projects_updated_at ON sourcing_projects;
CREATE TRIGGER trigger_sourcing_projects_updated_at
  BEFORE UPDATE ON sourcing_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_sourcing_suppliers_updated_at ON sourcing_suppliers;
CREATE TRIGGER trigger_sourcing_suppliers_updated_at
  BEFORE UPDATE ON sourcing_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_sourcing_quotes_updated_at ON sourcing_quotes;
CREATE TRIGGER trigger_sourcing_quotes_updated_at
  BEFORE UPDATE ON sourcing_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_sourcing_conditions_updated_at ON sourcing_conditions;
CREATE TRIGGER trigger_sourcing_conditions_updated_at
  BEFORE UPDATE ON sourcing_conditions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------
-- Row Level Security : activée SANS policy.
-- L'application accède exclusivement par la clé service_role, qui contourne la
-- RLS : aucune fonctionnalité n'est affectée. En revanche l'accès direct du rôle
-- anon via PostgREST est fermé — ces tables contiennent des prix d'achat, des
-- coûts d'outillage et des coordonnées fournisseurs qui ne doivent jamais sortir.
-- ------------------------------------------------
ALTER TABLE sourcing_projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_suppliers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_images      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_contact_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_conditions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_shares      ENABLE ROW LEVEL SECURITY;
