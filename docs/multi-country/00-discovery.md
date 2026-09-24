# Phase 0 — Découverte (lecture seule)

> Projet : OhMyGab (dépôt « Twinsk »), préparation du lancement **Oh My Cot** (Côte d'Ivoire).
> Date : 24 septembre 2026. Toutes les requêtes sur le projet Supabase Gabon
> `qaemzzpyrmoopfkiciki` ont été des `SELECT` (aucune écriture).

## 1. Résumé

| # | Constat | Impact sur la mission |
|---|---------|-----------------------|
| 1 | **Hébergement : Railway**, pas Vercel ni Netlify. `netlify.toml` et `DEPLOYMENT.md` sont obsolètes. | Phase 7 : second projet (ou service) Railway, pas Vercel. |
| 2 | **Pas de dossier `supabase/`** : 57 fichiers `supabase-migration-N.sql` à la racine, appliqués à la main dans l'éditeur SQL. Pas de `config.toml`, pas de `supabase/functions/`. | Phase 5 : il faut créer `supabase/` et une migration de base. |
| 3 | **Les tables cœur du commerce n'ont aucun fichier de création dans le dépôt** : `offers`, `offer_items`, `offer_products`, `offer_orders`, `offer_order_lines`, ainsi que `freight_requests`, `admin_collaborators`, `youtube_videos` et `youtube_video_products`. Elles viennent de 14 migrations appliquées directement sur Supabase (mai 2026) et absentes du code. | **Bloquant** : impossible de recréer la base CI depuis le dépôt. Une extraction du schéma réel (`db dump` ou `db pull`) est indispensable. |
| 4 | Trois fichiers locaux ne sont **que partiellement appliqués** en production (migrations 20, 30 et 32). | Le schéma réel diffère des fichiers : la base de référence doit venir de la production, pas des fichiers. |
| 5 | **Aucune fonction Edge**, aucun `pg_cron`, aucun `pg_net`, aucun webhook de base, aucun secret dans le coffre (`vault`). | Phase 3 largement sans objet. La logique serveur est dans les routes API Next.js ; les tâches planifiées sont des services Railway. |
| 6 | **Supabase Auth n'est pas utilisé** (0 utilisateur). Authentification maison : admin (mot de passe en variable d'env), collaborateurs (table `collaborators`, scrypt), agents (OTP WhatsApp). | La configuration Auth de la phase 5 est triviale. Pas de redirections ni de modèles d'e-mail à reproduire. |
| 7 | **Aucun agrégateur de paiement réel au Gabon** : Airtel Money par virement manuel avec preuve, espèces à l'agence ; « e-Billing » n'est qu'une maquette. | Phase 4 : l'interface de paiement habille des flux manuels. La Côte d'Ivoire (CinetPay ou PayDunya) serait le premier agrégateur réel. |
| 8 | **Sécurité** : 5 tables sans RLS (`offers`, `offer_items`, `offer_products`, `offer_orders`, `offer_order_lines`). `offer_orders` contient noms et numéros de clients. | À corriger indépendamment du multi-pays (voir § 9). |
| 9 | Les prix du catalogue sont stockés **en CNY**, convertis à l'affichage (1 CNY = 91 FCFA). XAF et XOF ont la même parité avec l'euro (655,957). | Le catalogue est neutre en devise : il pourrait être partagé entre pays. Décision à prendre (§ 10). |

## 2. Pile technique

| Élément | Valeur |
|---|---|
| Framework | Next.js 16.1.1, **App Router**, `output: 'standalone'`, React Compiler activé |
| React | 19.2.3 |
| UI | Tailwind CSS v4 (`@tailwindcss/postcss`), lucide-react, framer-motion, gsap + lenis, three / @react-three (pages vitrines) |
| État | Aucune bibliothèque (état React local, `localStorage` ponctuel) |
| i18n | Maison, admin uniquement : `src/lib/i18n/admin.ts` (FR / ZH). Pages publiques en français codé en dur |
| Données | `@supabase/supabase-js` 2.101, **côté serveur uniquement** (`src/lib/supabase/server.ts`, clé service). Le client navigateur `src/lib/supabase/client.ts` (clé anon) n'est importé nulle part |
| PDF | `@react-pdf/renderer` |
| Tests | Vitest (347 tests), ESLint `eslint-config-next` |
| Langage | TypeScript 5, alias `@/` → `src/` |
| Marques servies par le même dépôt | Twinsk (site logistique B2B, sourcing, admin) **et** Oh My Gab (vitrine `/bio`, listings `/offer/…`, commandes, messagerie WhatsApp) |

## 3. Hébergement et déploiement

| Élément | Valeur |
|---|---|
| Hébergeur | **Railway**, projet « Twinsk Company Ltd » (`9d4d806e-cac2-4e6d-9c48-37ba0d3411fb`), environnement unique `production` |
| Services | `twinsk` (application web, Dockerfile), `cron-catalog-drip` et `cron-cash` (conteneurs `curlimages/curl` qui appellent `/api/cron/*` avec `CRON_SECRET`) |
| Construction | `Dockerfile` + `railway.toml` (santé sur `/`, redémarrage sur échec) |
| Source | GitHub `FranckSowax/twinsk`, branche `main` : chaque poussée redéploie (~3 à 5 min) |
| Planificateur interne | `src/instrumentation.ts` lance la diffusion WhatsApp dans le processus web (désactivable : `DRIP_INTERNAL_SCHEDULER=off`) |
| Domaine | `twinsk-production.up.railway.app` (constante `PUBLIC_ORIGIN_FALLBACK`) ; pas de domaine personnalisé identifié |
| Reliques | `netlify.toml`, `DEPLOYMENT.md` (Netlify), `README.md` (landing Next 14) : obsolètes |

## 4. Variables d'environnement lues par le code

29 variables, toutes lues via `process.env` dans `src/` (aucun fichier `.env*` dans le dépôt, aucun `.env.example`).

| Variable | Côté | Fichiers | Rôle | Par pays ? |
|---|---|---|---|---|
| `ADMIN_PASSWORD` | serveur | 38 | Mot de passe admin, **aussi clé HMAC** des jetons collaborateurs et agents | oui (secret) |
| `NEXT_PUBLIC_SUPABASE_URL` | client | 3 | URL Supabase | **oui** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | 1 | Clé anon (client inutilisé) | **oui** |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur | 2 | Clé service | **oui** |
| `WHAPI_TOKEN` | serveur | 1 | API WhatsApp (canal = un numéro) | **oui** |
| `WHAPI_BASE_URL` | serveur | 1 | Base de l'API WHAPI | non |
| `WHAPI_GROUP_ID` | serveur | 1 | Groupe WhatsApp par défaut | **oui** |
| `WHAPI_ORDERS_GROUP_ID` | serveur | 1 | Groupe « Commandes » (équipe) | **oui** |
| `WHAPI_STAFF_GROUP_ID` | serveur | 1 | Groupe équipe (espèces) | **oui** |
| `WHAPI_WEBHOOK_SECRET` | serveur | 2 | Secret du webhook entrant | **oui** |
| `NEXT_PUBLIC_OMG_WHATSAPP_NUMBER` | client | 1 | Numéro WhatsApp affiché aux clients | **oui** |
| `ADMIN_WHATSAPP_NUMBER` | serveur | 2 | Numéro WhatsApp de l'admin | **oui** |
| `AIRTEL_MONEY_NUMBER` | serveur | 2 | Numéro Airtel Money encaissant | GA seulement |
| `AIR_RATE_FCFA_PER_KG` | serveur | 1 | Tarif aérien | **oui** |
| `AIR_BATTERY_RATE_FCFA_PER_KG` | serveur | 1 | Tarif aérien batteries | **oui** |
| `AIR_MAX_UNIT_VOLUME_M3` | serveur | 1 | Volume max. par article en aérien | probablement |
| `SEA_RATE_FCFA_PER_M3` | serveur | 1 | Tarif maritime | **oui** |
| `SEA_RATE_FLOOR_FCFA_PER_M3` | serveur | 1 | Plancher maritime dégressif | **oui** |
| `META_PAGE_ID` / `META_PAGE_TOKEN` / `META_IG_USER_ID` | serveur | 1 | Publication Facebook / Instagram | **oui** |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | serveur | 1 | Alertes internes | à décider |
| `CRON_SECRET` | serveur | 2 | Protection des routes `/api/cron/*` | oui (secret) |
| `RAPIDAPI_KEY` | serveur | 2 | Sourcing 1688 / Taobao | non (partageable) |
| `KIMI_API_KEY` | serveur | 2 | Traductions (notes) | non (partageable) |
| `DRIP_INTERNAL_SCHEDULER` | serveur | 1 | Désactive le planificateur interne | système |
| `NODE_ENV` / `NEXT_RUNTIME` | serveur | 3 / 1 | Système | système |

## 5. Supabase — migrations et écart avec la production

### 5.1 État du dépôt

| Élément | Présent ? | Détail |
|---|---|---|
| `supabase/` | **non** | — |
| `supabase/migrations/` | **non** | 57 fichiers `supabase-migration-{2..61}.sql` à la racine (numéros 1 et 12 à 14 absents), plus `supabase-schema.sql` |
| `supabase/functions/` | **non** | — |
| `supabase/config.toml` | **non** | — |
| Autres scripts SQL | oui | `supabase-backfill-catalog.sql`, `supabase-cleanup-commandes-test.sql` (ponctuels) |
| CLI Supabase | installé, **v2.2.1** (actuelle : v2.117) | Connecté à un compte qui voit le projet Gabon ; dépôt non lié (`supabase link` jamais fait) |
| Docker | 27.3.1 | Requis par `supabase db dump` / `db pull` |
| `pg_dump` local | v14 | **Trop ancien** pour la base en PostgreSQL 17.6 : passer par le CLI |

### 5.2 Historique distant (`supabase_migrations.schema_migrations`)

14 entrées, toutes du 10 au 29 mai 2026, appliquées par un outil (MCP ou CLI) et **absentes du dépôt** :
`create_leads_table`, `enable_rls_on_leads`, `create_freight_requests_table`, `add_supplier_info_to_freight_requests`, `create_admin_collaborators_table`, `add_quote_fields_to_freight_requests`, `add_client_decision_to_freight_requests`, `create_youtube_videos_and_products`, `rename_price_cny_to_price_usd`, `migration_11_variants`, `migration_12_client_variant_id`, `migration_13_offers_orders`, `migration_13b_offer_products_align`, `migration_14_logistics_v2`.

Les fichiers racine appliqués à la main ne figurent pas dans cet historique. `supabase migration list` ne peut donc rien comparer d'utile aujourd'hui.

### 5.3 Écart fichiers locaux ↔ production (analyse automatique)

Méthode : chaque `CREATE TABLE` et `ADD COLUMN` des 58 fichiers locaux, comparé au schéma réel (OpenAPI PostgREST, 46 tables).

| Constat | Détail |
|---|---|
| Fichiers entièrement appliqués | 55 sur 58 |
| `supabase-migration-20.sql` partiel | colonnes absentes : `search_results.repurchase_rate`, `sales`, `star_rate` |
| `supabase-migration-30.sql` partiel | colonnes absentes : `offer_order_lines.weight`, `volume`, `has_battery` (le code en tient déjà compte) |
| `supabase-migration-32.sql` partiel | table absente : `json_imports` |
| Tables en production **sans aucun fichier de création** | `offers`, `offer_items`, `offer_products`, `offer_orders`, `offer_order_lines`, `freight_requests`, `admin_collaborators`, `youtube_videos`, `youtube_video_products` |

**Conclusion** : la seule source fiable du schéma est la production. La phase 5 commencera par extraire le schéma réel en une migration de base.

## 6. Inventaire hors migrations

| Élément | Production Gabon | Remarque |
|---|---|---|
| Buckets de stockage | 1 : `request-images` — public, 50 Mo max., types `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4` ; 345 objets | Contient à la fois médias de marque (vidéos de listings, visuels) et fichiers liés aux clients (preuves de paiement Airtel, photos de colis, photos de demandes) |
| Politiques sur `storage.objects` | **aucune** | Lecture publique par le drapeau `public` ; écritures par la clé service (`/api/upload`) |
| Tâches `pg_cron` | **aucune** (schéma `cron` absent) | Planification : services Railway `cron-catalog-drip`, `cron-cash`, plus le planificateur interne |
| Webhooks de base, `net.http_post`, `supabase_functions.http_request` | **aucun** (schémas `net` et `supabase_functions` absents) | Webhook entrant WHAPI → route Next.js `/api/whapi/webhook` |
| Déclencheurs (hors schémas système) | 12, tous « mise à jour de `updated_at` » : `catalog`, `freight_requests`, `leads`, `offer_orders`, `offers`, `requests`, `sourcing_conditions`, `sourcing_projects`, `sourcing_quotes`, `sourcing_suppliers`, `youtube_video_products`, `youtube_videos` | Fonctions : `update_updated_at`, `touch_offers_updated_at`, `freight_requests_set_updated_at`, `leads_set_updated_at`, `youtube_set_updated_at` |
| Fonctions `public` | les 5 ci-dessus + fonctions de l'extension `pg_trgm` | Aucune fonction `SECURITY DEFINER` |
| Vues | aucune | — |
| Tables publiées en temps réel | aucune | — |
| Secrets `vault.secrets` | **aucun** (extension présente, coffre vide) | — |
| Extensions | `pg_stat_statements` 1.11, `pg_trgm` 1.6 (**dans `public`**), `pgcrypto` 1.3, `plpgsql`, `supabase_vault` 0.3.1, `uuid-ossp` 1.1 | À reproduire à l'identique ; `pg_trgm` dans `public` : signalé par les conseillers Supabase |
| Supabase Auth | 0 utilisateur, 0 identité, aucune connexion | Non utilisé. Fournisseurs, URL de redirection et modèles d'e-mail : non pertinents |
| Fonctions Edge | **aucune** | — |
| PostgreSQL | 17.6 | — |

## 7. Tables `public` — classification

**REFERENCE** : contenu ou configuration, candidat à un seed. **TRANSACTIONAL** : données de clients, d'équipe, d'activité ; jamais copiées.

| Table | Lignes | RLS | Politiques | Classe | Copie vers CI ? |
|---|---:|:-:|---:|---|---|
| `offers` | 101 | **non** | 0 | REFERENCE (listings, prix en CNY) | à décider (§ 10) |
| `offer_items` | 1 685 | **non** | 0 | REFERENCE (catégories des listings) | à décider |
| `offer_products` | 4 890 | **non** | 0 | REFERENCE (produits des listings) | à décider |
| `offer_phases` | 175 | oui | 0 | REFERENCE (phases B2B) | à décider |
| `catalog` | 1 976 | oui | 4 | REFERENCE (cache de sourcing Chine, neutre) | possible |
| `factories` | 38 | oui | 0 | REFERENCE (usines chinoises, neutre) | possible |
| `factory_dossiers` | 6 | oui | 0 | REFERENCE (dossiers d'usines) | possible |
| `youtube_videos` | 1 | oui | 0 | REFERENCE (contenu) | non (contenu GA) |
| `youtube_video_products` | 1 | oui | 0 | REFERENCE (contenu) | non |
| `promo_codes` | 1 | oui | 0 | REFERENCE par pays (config commerciale) | non |
| `wa_settings` | 19 | oui | 0 | **MIXTE** (voir § 8) | seulement les clés de configuration, réécrites pour CI |
| `offer_orders` | 37 | **non** | 0 | TRANSACTIONAL | **jamais** |
| `offer_order_lines` | 93 | **non** | 0 | TRANSACTIONAL | jamais |
| `promo_uses` | 1 | oui | 0 | TRANSACTIONAL | jamais |
| `requests` | 31 | oui | 3 | TRANSACTIONAL | jamais |
| `request_items` | 228 | oui | 2 | TRANSACTIONAL | jamais |
| `search_results` | 2 073 | oui | 1 | TRANSACTIONAL (résultats liés aux demandes) | jamais |
| `quotes` | 56 | oui | 1 | TRANSACTIONAL | jamais |
| `item_notes` | 1 | oui | 3 | TRANSACTIONAL | jamais |
| `order_notes` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `freight_requests` | 3 | oui | 0 | TRANSACTIONAL | jamais |
| `leads` | 4 | oui | 0 | TRANSACTIONAL | jamais |
| `affiliates` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `affiliate_offers` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `affiliate_requests` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `agents` | 2 | oui | 0 | TRANSACTIONAL (comptes équipe) | jamais |
| `agent_otps` | 9 | oui | 0 | TRANSACTIONAL | jamais |
| `agent_actions` | 0 | oui | 0 | TRANSACTIONAL (journal) | jamais |
| `collaborators` | 4 | oui | 0 | TRANSACTIONAL (comptes équipe) | jamais |
| `collab_actions` | 9 | oui | 0 | TRANSACTIONAL (journal) | jamais |
| `collab_review_lines` | 29 | oui | 0 | TRANSACTIONAL | jamais |
| `admin_collaborators` | 0 | oui | 0 | TRANSACTIONAL (table héritée, vide) | jamais |
| `playbook_log` | 381 | oui | 0 | TRANSACTIONAL (journal) | jamais |
| `sourcing_projects` | 1 | oui | 0 | TRANSACTIONAL (projets B2B) | jamais |
| `sourcing_suppliers` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `sourcing_quotes` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `sourcing_conditions` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `sourcing_images` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `sourcing_shares` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `sourcing_contact_log` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `wa_conversations` | 21 | oui | 0 | TRANSACTIONAL | jamais |
| `wa_messages` | 195 | oui | 0 | TRANSACTIONAL | jamais |
| `wa_departures` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `whapi_polls` | 0 | oui | 0 | TRANSACTIONAL | jamais |
| `wa_catalog_products` | 230 | oui | 0 | TRANSACTIONAL (synchro du catalogue du numéro GA) | jamais |
| `wa_catalog_collections` | 0 | oui | 0 | TRANSACTIONAL | jamais |

Total : 46 tables. 11 REFERENCE (dont 1 mixte), 35 TRANSACTIONAL.

## 8. Clés de `wa_settings` (réglages clé → JSON)

| Clé | Nature | Pour CI |
|---|---|---|
| `bio_page` | Config (page lien bio : titre, contacts, listings) | à réécrire (contacts CI) |
| `category_drip` (+ `category_drip:N`) | Config (campagnes de diffusion WhatsApp) | à réécrire (groupes CI) |
| `drip_media` | Config (médiathèque de diffusion) | à décider |
| `inbox_quick_replies` | Config (phrases rapides) | à adapter (textes GA) |
| `community`, `known_groups`, `salon_search`, `slots` | Config liée aux groupes WhatsApp du numéro GA | à recréer |
| `order_split:<id>`, `quote_transport:<id>` | **Transactionnel** (données de commandes et de devis) | jamais |

## 9. Constats de sécurité (hors périmètre, à traiter)

| Gravité | Constat | Recommandation |
|---|---|---|
| **Élevée** | RLS désactivée sur `offer_orders`, `offer_order_lines`, `offers`, `offer_items`, `offer_products`. Toute personne disposant de la clé anon peut lire (et écrire) ces tables, dont les noms et numéros de clients | Activer la RLS sur ces 5 tables (le code passe par la clé service : aucun impact attendu). Migration dédiée, à valider |
| Moyenne | `ADMIN_PASSWORD` sert aussi de clé de signature des jetons collaborateurs et agents | Séparer en `SESSION_SECRET` lors de la phase 2 |
| Moyenne | Bucket `request-images` public : preuves de paiement et photos de colis accessibles à qui connaît l'URL | Bucket privé séparé pour les fichiers clients (URLs signées) |
| Info | L'accès Supabase utilisé pour cette phase est **administrateur** (rôle `postgres`), pas en lecture seule | Préférer l'accès `read_only=true` lié au seul projet Gabon (voir la conversation) |
| Info | Extension `pg_trgm` installée dans `public` | À déplacer dans `extensions` (conseiller Supabase) |

## 10. Écarts avec les hypothèses de la mission, et décisions attendues

| Hypothèse de la mission | Réalité | Décision proposée / question |
|---|---|---|
| Hébergement Vercel / Netlify | Railway (Dockerfile) | Phase 7 : second service Railway `ohmycot` (même dépôt, même branche). **OK ?** |
| `supabase/migrations/` à rendre source de vérité | Absent ; schéma réel ≠ fichiers | Phase 5 : `supabase/migrations/<date>_baseline.sql` extrait de la production ; les 57 fichiers racine archivés dans `supabase/legacy/`. **OK ?** |
| Fonctions Edge à adapter | Aucune | Phase 3 réduite à la documentation des secrets des routes API. **OK ?** |
| Supabase Auth à reproduire | Non utilisé | Rien à configurer côté Auth |
| Fournisseurs de paiement GA (Airtel, Moov) | Airtel Money **manuel** + espèces ; e-Billing = maquette | Phase 4 : interface `PaymentProvider` avec adaptateurs « manuels » GA ; CI : agrégateur réel à choisir (CinetPay ou PayDunya) |
| Un seul produit par dépôt | Le dépôt sert Twinsk (logistique B2B, sourcing Chine) **et** Oh My Gab | **Question 1** : le déploiement CI embarque-t-il toute l'application (sourcing, fret, admin) sous la marque Oh My Cot, ou seulement la partie Oh My Gab ? |
| Zones de livraison en base | Aucune zone : livraison « à Libreville », tarifs de fret par variable d'env | Table `delivery_zones` à créer (phase 2) ; tarifs de fret par pays |
| Catalogue par pays | Prix en CNY, neutres en devise | **Question 2** : le catalogue (listings, produits) est-il **partagé** (copié à l'initialisation, puis indépendant) ou **vide** au départ en CI ? |
| Données transactionnelles | 35 tables | Aucune copie (conforme à la mission) |
| Accès Supabase lecture seule | Accès administrateur actuel | **Question 3** : conservez-vous cet accès, ou configurez-vous l'accès `read_only` avant la phase 5 ? |
| Extraction du schéma | CLI v2.2.1 ; `pg_dump` local v14 inutilisable (serveur en v17) | **Question 4** : j'aurai besoin de mettre à jour le CLI (`brew upgrade supabase`) et du mot de passe de la base Gabon pour `supabase db dump --schema-only` (lecture seule), à placer hors conversation |
