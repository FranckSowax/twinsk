-- ================================================
-- Twinsk — Migration #58
-- Usines : dossiers de classement d'ateliers (1688) importés au format JSON.
-- Un dossier = un fichier importé (méta, bassins industriels, repère de prix,
-- usines classées et ateliers écartés). Les usines sont éclatées en lignes
-- pour être triables (rang, crédit, note de service, réachat, atelier),
-- le JSON d'origine étant conservé intact dans payload / raw.
-- À exécuter dans le SQL Editor de Supabase. Idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS factory_dossiers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label              TEXT NOT NULL,                   -- titre affiché (meta.objet tronqué, ou saisi à l'import)
  objet              TEXT,                            -- meta.objet
  perimetre_arbitre  TEXT,                            -- meta.perimetre_arbitre
  marche_cible       TEXT,                            -- meta.marche_cible
  devise             TEXT,                            -- meta.devise (CNY…)
  methode            TEXT,                            -- meta.methode
  classement         TEXT,                            -- meta.classement (critère de tri annoncé)
  repere_de_prix     TEXT,                            -- meta.repere_de_prix
  genere_le          TIMESTAMPTZ,                     -- meta.genere_le, si lisible
  bassins            JSONB NOT NULL DEFAULT '{}'::jsonb,   -- meta.bassins_industriels
  ecartes            JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ateliers écartés + motif
  a_demander         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- a_demander_a_chaque_usine
  payload            JSONB NOT NULL,                  -- JSON importé, tel quel
  factory_count      INTEGER NOT NULL DEFAULT 0,
  ecarte_count       INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factory_dossiers_created_idx ON factory_dossiers (created_at DESC);

CREATE TABLE IF NOT EXISTS factories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id         UUID NOT NULL REFERENCES factory_dossiers(id) ON DELETE CASCADE,
  rang               INTEGER,                         -- rang publié dans le dossier (1 = tête)
  nom_cn             TEXT,
  nom_fr             TEXT,
  boutique           TEXT,                            -- URL de la boutique 1688
  specialite         TEXT,
  statut             TEXT,                            -- 生产厂家 (fabricant), distributeur…
  labels_1688        JSONB NOT NULL DEFAULT '[]'::jsonb,
  distinctions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  activite_30j       JSONB NOT NULL DEFAULT '{}'::jsonb,
  qualite            JSONB NOT NULL DEFAULT '{}'::jsonb,
  fiche_retenue      JSONB,                           -- offre retenue au catalogue (offer_id, prix…)
  cree_en            INTEGER,
  anciennete_ans     INTEGER,
  atelier_m2         INTEGER,
  effectif           TEXT,
  credit_1688        TEXT,                            -- libellé complet (« AAA — TOP 5 % »)
  credit_rang        SMALLINT,                        -- 3 = AAA, 2 = AA, 1 = A, NULL = non relevé (tri)
  note_service       NUMERIC,
  reachat            TEXT,                            -- libellé d'origine (« 59,8 % »)
  reachat_pct        NUMERIC,                         -- même valeur en nombre (tri)
  abonnes            TEXT,
  ventes_90j         TEXT,
  meilleure_fiche    TEXT,
  pourquoi           TEXT,
  reserve            TEXT,
  raw                JSONB NOT NULL,                  -- fiche usine d'origine, telle quelle
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS factories_dossier_idx ON factories (dossier_id, rang);

COMMENT ON TABLE factory_dossiers IS 'Dossiers « Usines » : un JSON de classement d''ateliers importé depuis /admin/usines.';
COMMENT ON TABLE factories IS 'Usines d''un dossier, une ligne par atelier ; colonnes normalisées pour le tri, fiche d''origine dans raw.';
COMMENT ON COLUMN factories.credit_rang IS 'Note de crédit 1688 rendue triable : 3 = AAA, 2 = AA, 1 = A, NULL = non relevé.';

-- ================================================
-- ROLLBACK
-- ================================================
-- DROP TABLE IF EXISTS factories;
-- DROP TABLE IF EXISTS factory_dossiers;
