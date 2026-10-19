-- ================================================
-- Achats sur place › factures fournisseurs (19 oct. 2026).
-- Sur place, le client photographie la facture reçue (le plus souvent un reçu
-- rose manuscrit) avec la carte de visite du fournisseur. La photo est lue et
-- traduite : fournisseur, adresse, contact, montant, acompte versé ou soldé,
-- délai. Chaque facture se rattache à une ligne d'achat ; le tableau de bord
-- en déduit ce qui est payé, ce qui reste dû et ce qui est soldé.
-- RLS activée sans politique : tout passe par les routes serveur (service_role).
-- Idempotente.
-- ================================================
CREATE TABLE IF NOT EXISTS public.buying_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.buying_trips(id) ON DELETE CASCADE,
  -- Ligne d'achat couverte par la facture (une facture peut n'en couvrir aucune
  -- au moment de la photo : l'équipe la rattache ensuite).
  item_id uuid REFERENCES public.buying_items(id) ON DELETE SET NULL,
  -- Photos de la facture et de la carte de visite : [{url, caption, at}].
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Fournisseur lu sur la facture / la carte (original chinois + traduction).
  supplier_name text,
  supplier_name_zh text,
  supplier_address text,
  supplier_address_zh text,
  supplier_contact text,
  -- Montants dans la devise de la facture (yuan en pratique).
  currency text NOT NULL DEFAULT 'CNY',
  total_amount numeric,
  paid_amount numeric,
  balance_amount numeric,
  payment_status text NOT NULL DEFAULT 'unknown' CHECK (payment_status IN ('unknown', 'unpaid', 'deposit', 'paid')),
  issued_on date,
  delivery_note text,
  items_text text,
  notes text,
  -- Texte lu sur la photo et lecture complète du modèle (pour relecture).
  raw_text text,
  analysis jsonb,
  created_by text NOT NULL DEFAULT 'client' CHECK (created_by IN ('client', 'team')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buying_receipts_trip_idx ON public.buying_receipts (trip_id, created_at);
CREATE INDEX IF NOT EXISTS buying_receipts_item_idx ON public.buying_receipts (item_id);
ALTER TABLE public.buying_receipts ENABLE ROW LEVEL SECURITY;
