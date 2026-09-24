-- ================================================
-- Durcissement : RLS sur les 5 tables du parcours d'offre qui ne l'avaient pas
-- (offers, offer_items, offer_products, offer_orders, offer_order_lines).
--
-- Sans RLS, la clé publique « anon » donne lecture et écriture sur ces tables,
-- dont les commandes clients (noms, téléphones). L'application ne s'en sert
-- pas : tout accès passe par les routes serveur avec la clé service_role, qui
-- ignore la RLS (le client navigateur src/lib/supabase/client.ts n'est importé
-- nulle part). Activer la RLS sans politique ferme donc cet accès sans rien
-- changer au fonctionnement.
--
-- Même régime que delivery_zones et payments. Idempotente.
-- ================================================
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_order_lines ENABLE ROW LEVEL SECURITY;
