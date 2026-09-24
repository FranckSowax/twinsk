# Phase 5 — Les migrations deviennent la source de vérité

> Branche `feat/multi-country`, 24 septembre 2026. Aucune écriture sur un projet distant pendant cette phase.

## 1. Schéma de base (baseline)

| Constat | Conséquence |
|---|---|
| 61 fichiers `supabase-migration-N.sql` appliqués à la main, dont certains partiellement (20, 30, 32), plus 14 migrations MCP de mai 2026 absentes du dépôt | Rejouer ces fichiers ne reproduit pas la base du Gabon |
| `supabase db pull` **écrit** dans l'historique des migrations du projet distant (il marque la baseline comme appliquée) | Interdit sur le Gabon, projet en lecture seule |
| CLI locale 2.2.1 : refuse Postgres 17 (`Invalid db.major_version: 17`) ; `pg_dump` local en version 14 | `db dump` impossible ici tant que la CLI n'est pas mise à jour |

**Méthode retenue.** Schéma reconstruit depuis le catalogue PostgreSQL du Gabon, par des requêtes SELECT uniquement : `pg_get_functiondef`, `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_triggerdef` et `pg_policy`.

**Vérification.** Le fichier a été appliqué sur un Postgres 17 vierge (Docker, local). J'ai ensuite comparé une empreinte du schéma public, calculée sur les deux bases avec `scripts/supabase/schema-fingerprint.sql`. Les 9 rubriques sont **identiques** :

| Rubrique | Nombre |
|---|---|
| Tables | 46 |
| Colonnes | 634 |
| Contraintes | 121 |
| Index | 120 |
| Déclencheurs | 12 |
| Politiques | 14 |
| Tables sous RLS | 41 |
| Fonctions | 5 |
| Valeurs d'énumérations | 9 |

Hors schéma public, rien à reprendre :
- aucune politique sur `storage.objects` ;
- aucune publication realtime ;
- ni pg_cron, ni pg_net, ni webhook de base, ni fonction Edge ;
- Supabase Auth inutilisé ;
- droits d'accès par défaut de Supabase sur les 46 tables.

**Recoupement facultatif** avec l'outil officiel, une fois la CLI à jour. Cette commande ne fait que lire ; elle demande le mot de passe de la base :

```bash
supabase db dump --linked --schema public -f /tmp/ga-public.sql
```

## 2. Le dossier `supabase/`

| Fichier | Rôle |
|---|---|
| `config.toml` | Modèle officiel de la CLI. Postgres 17 ; domaine via `env(SUPABASE_AUTH_SITE_URL)` ; **inscriptions Supabase Auth fermées** (l'app ne s'en sert pas) ; bucket `request-images` pour la pile locale |
| `migrations/20260924000000_baseline_ga.sql` | Schéma du Gabon au 24 septembre (déjà en place au Gabon) |
| `migrations/20260924000100_xof_delivery_zones.sql` | Ancienne migration 62 : XOF autorisé, table `delivery_zones` |
| `migrations/20260924000200_payments_affiliate_payout.sql` | Ancienne migration 63 : table `payments`, numéro d'encaissement des affiliés |
| `migrations/20260924000300_rls_offer_tables.sql` | **Nouveau.** RLS sur `offers`, `offer_items`, `offer_products`, `offer_orders`, `offer_order_lines` |
| `seed/reference/common.sql` | Aucune donnée commune à ce jour (fichier gardé pour l'ordre d'exécution) |
| `seed/reference/GA.sql` | Zone Libreville |
| `seed/reference/CI.sql` | Défaut `offer_currency = 'XOF'` et 12 communes d'Abidjan (provisoires) |
| `.env.example` | Variables lues par la CLI (noms seulement) |

Les fichiers racine `supabase-migration-62.sql` et `-63.sql` ont été déplacés dans `supabase/migrations/`. Les fichiers 1 à 61 restent à la racine comme archive.

**Pourquoi la migration RLS.** Ces 5 tables n'ont pas de RLS au Gabon. La clé publique `anon` peut donc y lire et y écrire, y compris les commandes clients avec noms et téléphones. L'application ne s'en sert jamais : tout passe par le serveur avec la clé `service_role`, qui ignore la RLS. Le client navigateur `src/lib/supabase/client.ts` n'est importé nulle part. Activer la RLS ferme cet accès sans rien changer au fonctionnement. Les 14 politiques « ouvertes à tous » du Gabon, sur `catalog`, `requests` et d'autres tables, sont reprises telles quelles. Leur retrait est une décision à prendre à part.

**Essais locaux**, sur des bases jetables :

| Chaîne | Résultat |
|---|---|
| Côte d'Ivoire : 4 migrations, puis `common.sql` et `CI.sql`, joués deux fois | 48 tables, toutes sous RLS ; 12 communes ; défaut XOF |
| Gabon : baseline, puis les 3 migrations suivantes et `GA.sql`, joués deux fois | Idempotent ; zone Libreville par défaut |

## 3. Scripts `scripts/supabase/`

Le projet visé est lu dans l'environnement (`SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`). Chaque script tourne en **aperçu par défaut** et n'écrit qu'avec `--apply`. L'écriture est **refusée sur le Gabon** (`GA_PROJECT_REF` et la référence connue), sauf `--allow-protected`.

| Script | Rôle |
|---|---|
| `recreate-buckets.ts` | Crée ou aligne `request-images` (public, 50 Mio, jpeg/png/webp/gif/mp4) |
| `copy-shared-assets.ts` | Facultatif. Ne copie rien sans `--prefix` explicite et refuse la racine du bucket. Au Gabon, la racine mélange photos de listing, preuves de paiement et photos de colis. Le projet source est seulement lu |
| `setup-cron.sql` | Aucune tâche pg_cron : les tâches planifiées sont des services Railway (phase 7). Modèle Vault en commentaire |
| `setup-webhooks.sql` | Aucun webhook de base. WHAPI et PayDunya se règlent côté application |
| `schema-fingerprint.sql` | Empreinte du schéma pour comparer deux projets (SELECT seulement) |

## 4. ⛔ Checkpoint 5 : commandes prévues sur le projet Côte d'Ivoire, dans l'ordre

Prérequis, à faire par Franck :
- `brew trust --formula supabase/tap/supabase && brew upgrade supabase` (la CLI 2.2.1 ne gère pas Postgres 17) ;
- `supabase login` ;
- créer le projet **Oh My Cot** (région `eu-west-3` ou `eu-west-1`) et me donner sa référence.

| # | Commande | Écrit ? |
|---|---|---|
| 1 | `supabase link --project-ref <CI_REF>` | Non (fichiers locaux `supabase/.temp`) |
| 2 | `supabase migration list` | Non ; attendu : historique distant vide |
| 3 | `supabase db push --dry-run` | Non ; attendu : les 4 migrations |
| 4 | `supabase db push` | **Oui** : crée le schéma |
| 5 | `psql "$CI_DB_URL" -f supabase/seed/reference/common.sql` | Oui (rien à insérer) |
| 6 | `psql "$CI_DB_URL" -f supabase/seed/reference/CI.sql` | **Oui** : défaut XOF, 12 communes |
| 7 | `supabase functions deploy`, `supabase secrets set` | **Sans objet** : aucune fonction Edge |
| 8 | `SUPABASE_AUTH_SITE_URL=https://ohmycot-production.up.railway.app supabase config push` | **Oui** : réglages Auth, inscriptions fermées (la CLI affiche l'écart et demande confirmation) |
| 9 | `npx tsx scripts/supabase/recreate-buckets.ts`, puis la même commande avec `--apply` | **Oui** : bucket `request-images` |
| 10 | `setup-cron.sql`, `setup-webhooks.sql` | Sans objet |

Vérifications, en lecture seule :
- `schema-fingerprint.sql` sur les deux projets. Seuls écarts attendus : les objets des migrations `…0100` à `…0300` tant que le Gabon ne les a pas, et le défaut XOF en CI ;
- conseiller de sécurité Supabase : aucune table sans RLS ;
- comptage des tables transactionnelles en CI (commandes, conversations, prospects…) : zéro ligne.

## 5. Aligner l'historique du Gabon (décision de Franck, hors phase 6)

La baseline est déjà en place au Gabon, mais l'historique distant ne la connaît pas : il liste les 14 migrations de mai. Tant que rien n'est fait, un `db push` vers le Gabon tenterait de rejouer la baseline et échouerait. La correction n'écrit que dans la table d'historique, pas dans le schéma. Comme elle touche le Gabon, **c'est à toi de la lancer ou de l'autoriser** :

```bash
supabase link --project-ref qaemzzpyrmoopfkiciki
supabase migration repair --status reverted 20260510160358 20260510160417 20260510183947 20260510191249 20260510191659 20260511002208 20260511002702 20260511004945 20260511013010 20260529095418 20260529110101 20260529164449 20260529164554 20260529170638
supabase migration repair --status applied 20260924000000
supabase migration list
```

Ensuite, les migrations `…0100`, `…0200` et `…0300` passent au Gabon par `supabase db push`, avec ton accord. Autre possibilité : les coller dans le SQL Editor comme avant, puis les marquer « applied » avec `migration repair`.
