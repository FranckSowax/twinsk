-- ================================================
-- Achats sur place : sous-lignes (7 oct. 2026).
-- Un article composé (ex. « Packaging cadeaux d'entreprise » avec plusieurs
-- modèles en photo) se décline en sous-lignes, une par photo / modèle, chacune
-- avec son statut, son prix et sa quantité ; l'article parent sert d'en-tête
-- et suit le même jour de visite que ses sous-lignes. Idempotente.
-- ================================================
ALTER TABLE public.buying_items ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.buying_items(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS buying_items_parent_idx ON public.buying_items (parent_id);
