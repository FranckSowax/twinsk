-- Empreinte du schéma public, pour comparer deux projets (GA et CI) sans rien
-- écrire : SELECT uniquement. À exécuter sur chaque projet (SQL Editor ou psql)
-- puis comparer les lignes. Même résultat = même schéma pour la rubrique.
-- Écarts attendus tant que le Gabon n'a pas reçu les migrations
-- 20260924000100 à 20260924000300 : colonnes, contraintes, index, RLS
-- (delivery_zones, payments, payout_*, RLS des tables d'offre, XOF), et en CI
-- le défaut offers.offer_currency = 'XOF' (seed CI.sql).
-- L'ordre physique des colonnes n'entre pas dans l'empreinte (il diffère dès
-- qu'une colonne a été supprimée au Gabon).
with t as (select c.oid, c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r')
select 'columns' as rubrique, count(*) as n, md5(string_agg(x, ';' order by x collate "C")) as empreinte
  from (select t.relname || '|' || a.attname || '|' || format_type(a.atttypid, a.atttypmod) || '|' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || '|' || a.attnotnull::text as x
          from t join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
          left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum) s
union all select 'constraints', count(*), md5(string_agg(x, ';' order by x collate "C")) from (select conrelid::regclass::text || '|' || conname || '|' || pg_get_constraintdef(k.oid) as x from pg_constraint k where conrelid in (select oid from t)) s
union all select 'indexes', count(*), md5(string_agg(x, ';' order by x collate "C")) from (select pg_get_indexdef(indexrelid) as x from pg_index where indrelid in (select oid from t)) s
union all select 'triggers', count(*), md5(string_agg(x, ';' order by x collate "C")) from (select pg_get_triggerdef(g.oid) as x from pg_trigger g where tgrelid in (select oid from t) and not tgisinternal) s
union all select 'policies', count(*), md5(string_agg(x, ';' order by x collate "C")) from (select tablename || '|' || policyname || '|' || permissive || '|' || roles::text || '|' || cmd || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '') as x from pg_policies where schemaname = 'public') s
union all select 'rls', count(*) filter (where relrowsecurity), md5(string_agg(relname || '|' || relrowsecurity::text, ';' order by relname collate "C")) from t
union all select 'functions', count(*), md5(string_agg(x, ';' order by x collate "C")) from (select p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|' || p.prosrc as x from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')) s
union all select 'enums', count(*), md5(string_agg(x, ';' order by x collate "C")) from (select t2.typname || '|' || e.enumsortorder::text || '|' || e.enumlabel as x from pg_enum e join pg_type t2 on t2.oid = e.enumtypid join pg_namespace n on n.oid = t2.typnamespace where n.nspname = 'public') s
union all select 'tables', count(*), md5(string_agg(relname, ';' order by relname collate "C")) from t
order by 1;
