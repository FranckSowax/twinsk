-- Purge des commandes DÉMO / TEST (table /admin/commandes).
-- À coller dans le SQL Editor Supabase (projet qaemzzpyrmoopfkiciki).
-- ⚠️ Supprime TOUTES les commandes existantes (toutes sont des tests pré-lancement).
--    Les vraies commandes arriveront ensuite avec coordonnées obligatoires
--    + notification dans le groupe 🧾 Commandes Oh My Gab.

-- 0) Aperçu avant suppression (facultatif — exécutez d'abord pour vérifier) :
-- SELECT id, client_name, client_phone, payment_status, created_at
-- FROM offer_orders ORDER BY created_at DESC;

BEGIN;

-- 1) Lignes de commandes
DELETE FROM offer_order_lines;

-- 2) Demandes miroir créées par ces commandes dans /admin/requests
--    (uniquement celles liées à une commande, pas les demandes de sourcing normales)
DELETE FROM search_results
WHERE request_item_id IN (
  SELECT ri.id FROM request_items ri
  WHERE ri.request_id IN (SELECT request_id FROM offer_orders WHERE request_id IS NOT NULL)
);
DELETE FROM request_items
WHERE request_id IN (SELECT request_id FROM offer_orders WHERE request_id IS NOT NULL);
DELETE FROM requests
WHERE id IN (SELECT request_id FROM offer_orders WHERE request_id IS NOT NULL);

-- 3) Les commandes elles-mêmes
DELETE FROM offer_orders;

COMMIT;

NOTIFY pgrst, 'reload schema';
