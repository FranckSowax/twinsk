-- Migration 53 — Photos de colis (process Oh My Gab, étapes 5 et 6).
-- Anna photographie les colis en Chine ; Ruth photographie à l'arrivée au Gabon.
-- Stockage : tableau JSON sur la commande (pas de table dédiée — une seule
-- colonne, lecture directe avec la commande, aucun join).
-- Chaque entrée : { url, stage: 'china'|'gabon', by, at }

ALTER TABLE offer_orders
  ADD COLUMN IF NOT EXISTS parcel_photos jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
