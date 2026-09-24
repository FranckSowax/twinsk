-- Données de référence propres à la Côte d'Ivoire (Oh My Cot). Idempotent.
-- À exécuter APRÈS les migrations et common.sql, sur le projet CI uniquement.

-- 1. Devise par défaut des listings : franc CFA d'Afrique de l'Ouest (décision D4).
--    Seul écart de schéma voulu entre les deux pays.
ALTER TABLE public.offers ALTER COLUMN offer_currency SET DEFAULT 'XOF';

-- 2. Zones de livraison : communes d'Abidjan (provisoires).
--    Tarifs donnés par Franck le 24 sept. 2026 (12 000 XOF/kg aérien,
--    215 000 XOF/m³ maritime, sans dégressivité), identiques à COUNTRIES.CI.
--    TODO(franck) : tarif aérien batterie (18 000 = valeur du Gabon en attendant),
--    délais vers Abidjan (valeurs du Gabon en attendant), commune de l'agence
--    (zone par défaut, aucune pour l'instant), livraison à domicile et frais.
INSERT INTO public.delivery_zones (
  code, label, city, hub_code, is_default, home_delivery, delivery_fee, pickup_agency,
  transit_air_min_days, transit_air_max_days, transit_sea_min_days, transit_sea_max_days,
  air_rate_per_kg, air_battery_rate_per_kg, sea_rate_per_m3, sea_rate_floor_per_m3, position
)
SELECT z.code, z.label, 'Abidjan', 'ABJ', false, false, 0, 'agence Oh My Cot',
       8, 14, 60, 85,
       12000, 18000, 215000, 215000, z.position
FROM (VALUES
  ('abidjan-cocody',      'Cocody',      0),
  ('abidjan-plateau',     'Plateau',     1),
  ('abidjan-marcory',     'Marcory',     2),
  ('abidjan-treichville', 'Treichville', 3),
  ('abidjan-yopougon',    'Yopougon',    4),
  ('abidjan-abobo',       'Abobo',       5),
  ('abidjan-adjame',      'Adjamé',      6),
  ('abidjan-koumassi',    'Koumassi',    7),
  ('abidjan-port-bouet',  'Port-Bouët',  8),
  ('abidjan-attecoube',   'Attécoubé',   9),
  ('abidjan-bingerville', 'Bingerville', 10),
  ('abidjan-anyama',      'Anyama',      11)
) AS z(code, label, position)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label, city = EXCLUDED.city, hub_code = EXCLUDED.hub_code,
  pickup_agency = EXCLUDED.pickup_agency,
  transit_air_min_days = EXCLUDED.transit_air_min_days, transit_air_max_days = EXCLUDED.transit_air_max_days,
  transit_sea_min_days = EXCLUDED.transit_sea_min_days, transit_sea_max_days = EXCLUDED.transit_sea_max_days,
  air_rate_per_kg = EXCLUDED.air_rate_per_kg, air_battery_rate_per_kg = EXCLUDED.air_battery_rate_per_kg,
  sea_rate_per_m3 = EXCLUDED.sea_rate_per_m3, sea_rate_floor_per_m3 = EXCLUDED.sea_rate_floor_per_m3,
  position = EXCLUDED.position, updated_at = now();
