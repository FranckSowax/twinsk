# Phase 6 — Provisionnement du projet Supabase Côte d'Ivoire

> 24 septembre 2026, sur le feu vert de Franck (« go phase 6 »). Projet **OH MY COT**, référence `pjindxsnwheoztvpqbbe`, région eu-west-1 (Irlande), Postgres 17.6. Organisation `ayllncukpuvfveyrfhtb`, distincte de celle de Twinsk.

## 1. Ce qui a été fait

| # | Commande | Résultat |
|---|---|---|
| 0 | Contrôles en lecture | Base vide : 0 table publique, 0 bucket, extensions par défaut. Historique vide |
| 1 | `supabase db push` | 4 migrations appliquées : `…0000` à `…0300` |
| 2 | `db query --linked -f common.sql`, puis `-f CI.sql` | Défaut `offer_currency = 'XOF'` ; 12 communes d'Abidjan |
| 3 | `config push` | **En attente de validation** (voir §3) |
| 4 | `recreate-buckets.ts --apply` | `request-images` créé ; relance → « conforme ». Clé service lue par la CLI, jamais affichée |
| — | `functions deploy`, `secrets set`, cron, webhooks | Sans objet (aucune fonction Edge, aucune tâche pg_cron, aucun webhook de base) |

CLI utilisée : **2.117.0 via `npx`**. La compilation par Homebrew sur un Mac Intel est trop lourde (LLVM, Rust, Go…). SQL exécuté par `supabase db query --linked` (API de gestion) : aucun mot de passe de base manipulé.

## 2. Vérifications

**Schéma.** L'empreinte du projet CI est identique, rubrique par rubrique, à celle de la chaîne testée en local. Les fonctions, déclencheurs, politiques et types sont les mêmes qu'au Gabon. Les écarts avec le Gabon sont ceux attendus :

| Rubrique | Gabon | CI | Écart |
|---|---|---|---|
| Tables | 46 | 48 | `delivery_zones`, `payments` |
| Tables sous RLS | 41 | 48 | + ces 2 tables et les 5 tables d'offre |
| Colonnes | 634 | 668 | nouvelles tables, `payout_number`, `payout_provider` ; défaut XOF |
| Contraintes | 121 | 127 | clés et contrôles des nouvelles tables ; XOF dans 2 contrôles |
| Index | 120 | 126 | index des nouvelles tables |
| Déclencheurs, politiques, fonctions, types | 12, 14, 5, 9 | idem | aucun |

Ces écarts disparaissent au Gabon dès qu'il reçoit les migrations `…0100` à `…0300`, sauf le défaut XOF, qui est voulu.

**Sécurité** (conseiller Supabase) : **aucune table sans RLS**. Deux avertissements, hérités à l'identique du Gabon :

| Avertissement | Nombre | Détail |
|---|---|---|
| `function_search_path_mutable` | 5 | Fonctions `updated_at` sans `search_path` fixé |
| `extension_in_public` | 1 | `pg_trgm` installé dans le schéma `public` |

Correction possible par une migration commune aux deux pays, à décider.

**Aucune donnée transactionnelle.** Seule table remplie : `delivery_zones` (12 lignes). Commandes, listings, conversations, prospects, agents, collaborateurs, affiliés, codes promo, paiements et réglages : 0 ligne. Stockage : 0 fichier.

## 3. Réglages Auth (`config push`) : écart à valider

Point important de la CLI 2.117 : sans terminal interactif, `config push` **applique sans demander**. Le modèle `config.toml` de `supabase init` déclarait des valeurs de développement local, qui auraient écrasé des réglages de production :
- délai minimal entre deux e-mails : 1 s au lieu de 1 min ;
- codes à 6 chiffres au lieu de 8 ;
- MFA coupée ;
- taille du pooler modifiée.

Ces clés ne sont plus déclarées. Le projet garde donc ses valeurs. `supabase config diff` ne montre plus que les 4 changements voulus :

| Réglage | Actuel | Après |
|---|---|---|
| `auth.site_url` | `http://localhost:3000` | `https://ohmycot-production.up.railway.app` |
| `auth.additional_redirect_urls` | vide | le même domaine |
| `auth.enable_signup` | activé | **désactivé** |
| `auth.email.enable_signup` | activé | **désactivé** |

Conséquence : personne ne peut créer de compte Supabase Auth avec la clé publique. L'application ne s'en sert pas (connexions admin, collaborateurs et agents propres à l'app).

## 4. À savoir

- Le dossier de la branche est désormais **lié au projet CI** (`supabase/.temp/project-ref`, non versionné). Toute commande `supabase` lancée depuis ce dossier vise la Côte d'Ivoire.
- Le connecteur Supabase de cette session n'a pas accès au projet, qui est dans une autre organisation. Tout passe par la CLI.
