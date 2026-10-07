-- ================================================
-- Achats sur place (7 oct. 2026) : un client qui vient acheter en Chine envoie
-- sa liste (texte, liens, photos) ; l'équipe la regroupe en jours de visite
-- (même zone, même fournisseur) ; sur place, le client coche, chiffre, note et
-- photographie ; l'app totalise (¥ et devise locale) et suit le délai usine →
-- cargo. Partie Twinsk seulement (COUNTRY.modules.twinsk) ; tables créées dans
-- les deux pays (schéma commun). Accès serveur uniquement (service_role) :
-- RLS active sans politique. Non destructive, idempotente.
-- ================================================

CREATE TABLE IF NOT EXISTS public.buying_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'planned', 'on_site', 'done')),
  -- Lien client : /achat/<token>, une personne = un lien.
  token text NOT NULL UNIQUE,
  -- Date limite d'arrivée des marchandises au cargo (groupage).
  cargo_cutoff date,
  -- Note interne de l'équipe (jamais montrée au client).
  notes text,
  -- Message du client envoyé avec sa liste.
  client_notes text,
  -- Listing B2C dédié (créé au premier produit importé pour commande en ligne).
  online_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buying_trips_created_idx ON public.buying_trips (created_at DESC);

CREATE TABLE IF NOT EXISTS public.buying_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.buying_trips(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  title text NOT NULL,
  visit_date date,
  zone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buying_days_trip_idx ON public.buying_days (trip_id, position);

CREATE TABLE IF NOT EXISTS public.buying_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.buying_trips(id) ON DELETE CASCADE,
  day_id uuid REFERENCES public.buying_days(id) ON DELETE SET NULL,
  position int NOT NULL DEFAULT 0,
  label text NOT NULL,
  details text,
  link text,
  -- Photos envoyées avec la liste : [{url, caption}] (stockage public request-images).
  source_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  quantity numeric,
  unit text,
  -- Équipe : où acheter, délai usine → cargo (jours).
  supplier text,
  zone text,
  lead_time_days int,
  team_note text,
  -- Sur place, par le client.
  status text NOT NULL DEFAULT 'to_buy' CHECK (status IN ('to_buy', 'bought', 'skipped', 'ordered_online')),
  price_cny numeric,
  qty_bought numeric,
  client_note text,
  -- Photos prises sur place : [{url, caption, at}].
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  bought_at timestamptz,
  -- Alternative « Prix en ligne » : un produit d'un listing B2B / B2C (ou importé
  -- dans le listing du voyage) que le client peut commander en ligne au lieu
  -- d'acheter sur place. Prix unitaire figé marge comprise (¥), commande créée
  -- dans le panier /offer comme toute commande.
  online_product_id uuid REFERENCES public.offer_products(id) ON DELETE SET NULL,
  online_variant_id text,
  online_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  online_title text,
  online_image_url text,
  online_price_cny numeric,
  online_moq int,
  online_note text,
  online_order_id uuid REFERENCES public.offer_orders(id) ON DELETE SET NULL,
  online_ordered_at timestamptz,
  online_qty numeric,
  created_by text NOT NULL DEFAULT 'client' CHECK (created_by IN ('client', 'team')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buying_items_trip_idx ON public.buying_items (trip_id, position);
CREATE INDEX IF NOT EXISTS buying_items_day_idx ON public.buying_items (day_id);

ALTER TABLE public.buying_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buying_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buying_items ENABLE ROW LEVEL SECURITY;
