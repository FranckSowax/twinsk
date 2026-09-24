-- Données de référence propres au Gabon (Oh My Gab). Idempotent.
-- Valeurs identiques à src/config/countries.ts (COUNTRIES.GA).
INSERT INTO delivery_zones (
  code, label, city, hub_code, is_default, home_delivery, delivery_fee, pickup_agency,
  transit_air_min_days, transit_air_max_days, transit_sea_min_days, transit_sea_max_days,
  air_rate_per_kg, air_battery_rate_per_kg, sea_rate_per_m3, sea_rate_floor_per_m3, position
) VALUES (
  'libreville', 'Libreville', 'Libreville', 'LBV', true, true, 0, 'agence TWINSK',
  8, 14, 60, 85,
  13000, 18000, 240000, 205000, 0
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label, city = EXCLUDED.city, hub_code = EXCLUDED.hub_code,
  is_default = EXCLUDED.is_default, home_delivery = EXCLUDED.home_delivery,
  delivery_fee = EXCLUDED.delivery_fee, pickup_agency = EXCLUDED.pickup_agency,
  transit_air_min_days = EXCLUDED.transit_air_min_days, transit_air_max_days = EXCLUDED.transit_air_max_days,
  transit_sea_min_days = EXCLUDED.transit_sea_min_days, transit_sea_max_days = EXCLUDED.transit_sea_max_days,
  air_rate_per_kg = EXCLUDED.air_rate_per_kg, air_battery_rate_per_kg = EXCLUDED.air_battery_rate_per_kg,
  sea_rate_per_m3 = EXCLUDED.sea_rate_per_m3, sea_rate_floor_per_m3 = EXCLUDED.sea_rate_floor_per_m3,
  updated_at = now();
