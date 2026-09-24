# Phase 7 — Déploiement et automatisation

> Branche `feat/multi-country`, 24 septembre 2026.

## 1. Corrections faites dans le code

| Correction | Pourquoi | Effet au Gabon |
|---|---|---|
| **`Dockerfile` : `ARG NEXT_PUBLIC_COUNTRY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_OMG_WHATSAPP_NUMBER`** | Railway ne transmet une variable à un build Dockerfile que si elle est déclarée en `ARG` (documentation Railway). Or le pays est figé au build, dans le code navigateur **et** dans le serveur (vérifié : un build CI relancé sans variable reste CI). Sans ces `ARG`, le service ivoirien aurait été compilé comme le Gabon | Aucun : variables absentes, build identique (vérifié : `GA` au build et à l'exécution, accueil 200) |
| **`/api/health`** | Contrôle de santé léger : pays à l'exécution, pays du build, version déployée ; `?deep=1` teste la base. Répond 503 si les deux pays diffèrent | Nouvelle route |
| **`railway.toml` : `healthcheckPath = "/api/health"`** | En CI, `/` redirige vers `/bio` : un contrôle sur `/` ne répondrait pas 200 | Contrôle plus léger qu'un rendu de l'accueil |
| **`next.config.ts` : `env.BUILD_COUNTRY`** | Expose le pays figé au build pour `/api/health` | Aucun |

## 2. Test de fumée : `scripts/smoke.ts`

Lecture seule. Lancement : `npx tsx scripts/smoke.ts`, ou `--country CI --url https://…`.

| Contrôle | Attendu |
|---|---|
| `/api/health?deep=1` | 200 ; pays à l'exécution = pays du build = pays attendu ; base joignable |
| `/bio` | 200, affiche la marque du pays |
| `/` | Gabon : 200. Côte d'Ivoire : redirection vers `/bio` (option B) |
| `/admin` | 200 ou redirection de connexion |

Sortie en erreur au premier pays en échec, avec le détail. 3 tests unitaires, dont un build CI compilé comme le Gabon (détecté).

## 3. Migrations des deux pays : `.github/workflows/migrate-all-countries.yml`

Se déclenche à chaque fusion sur `main` qui touche `supabase/migrations/**` ou `supabase/functions/**`, ou à la main (`workflow_dispatch`).

- Traite les pays un par un : **Côte d'Ivoire d'abord, puis Gabon**.
- Au premier échec, les pays restants sont annulés. Le résumé indique le pays en échec.
- Le Gabon passe par l'environnement GitHub `supabase-ga`, qui exige ton approbation.
- Avant tout `db push`, le workflow vérifie que la baseline est dans l'historique du projet. Il refuse d'aller plus loin au Gabon tant que `migration repair` n'a pas été fait (05, §5).
- Enchaînement : aperçu (`--dry-run`), puis `db push`, puis fonctions Edge s'il y en a (aucune aujourd'hui).

**À régler par Franck dans GitHub** (Settings du dépôt `FranckSowax/twinsk`) :

| Où | Quoi |
|---|---|
| Secrets and variables › Actions | `SUPABASE_ACCESS_TOKEN` (jeton personnel Supabase, compte qui voit les deux projets), `GA_PROJECT_REF` = `qaemzzpyrmoopfkiciki`, `CI_PROJECT_REF` = `pjindxsnwheoztvpqbbe` |
| Environments | `supabase-ci` (sans relecteur) ; `supabase-ga` avec **Required reviewers : toi** |

Le fichier n'agit qu'une fois sur `main`. Tant que la branche n'est pas fusionnée, il ne se déclenche pas.

## 4. Railway : écritures faites le 24 septembre (« go les deux »)

Même projet Railway « Twinsk Company Ltd » (environnement production, région europe-west4). Les services s'y référencent entre eux (`${{ohmycot.…}}`), ce qui est impossible d'un projet à l'autre.

| # | Écriture | Détail |
|---|---|---|
| R1 | Créer le service **`ohmycot`** | Dépôt `FranckSowax/twinsk`, **branche `feat/multi-country`** tant que la branche n'est pas fusionnée (ensuite : `main`). Build par le `Dockerfile` (`railway.toml`) |
| R2 | Domaine Railway du service | Port 8080 comme `twinsk` ; nom visé `ohmycot-production.up.railway.app` |
| R3 | Variables de `ohmycot` | Voir tableau ci-dessous |
| R4 | Créer **`ohmycot-cron-cash`** | Image `curlimages/curl`, toutes les 15 min, `curl -fsS "$APP_URL/api/cron/cash-reminders?key=$CRON_SECRET"`, avec `APP_URL=https://${{ohmycot.RAILWAY_PUBLIC_DOMAIN}}` et `CRON_SECRET=${{ohmycot.CRON_SECRET}}` |
| — | Diffusion horaire (équivalent de `cron-catalog-drip`) | **Reportée** : sans numéro WhatsApp ivoirien, elle n'a rien à diffuser |

Variables de `ohmycot` :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_COUNTRY` | `CI` |
| `NEXT_PUBLIC_SITE_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (domaine réel du service) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pjindxsnwheoztvpqbbe.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Clés du projet CI, lues par la CLI et transmises sans être affichées |
| `ADMIN_PASSWORD`, `CRON_SECRET`, `WHAPI_WEBHOOK_SECRET` | Générés aléatoirement, jamais affichés. Tu lis `ADMIN_PASSWORD` dans Railway |
| En attente de toi | `WHAPI_TOKEN` (numéro WhatsApp CI), `PAYDUNYA_*` (compte marchand), `META_*` (page Facebook / Instagram CI), variables d'analyse |

Non repris en CI : `AIRTEL_MONEY_NUMBER` (Gabon), `RAPIDAPI_KEY` et `KIMI_API_KEY` (le sourcing reste au Gabon, option B).

Après le premier déploiement : `npx tsx scripts/smoke.ts --country CI --url https://<domaine>`.

### Résultat

| Élément | État |
|---|---|
| Service `ohmycot` | En ligne : https://ohmycot-production.up.railway.app (branche `feat/multi-country`, commit `46e675d`) |
| Test de fumée CI | **8/8** : santé 200, pays CI à l'exécution **et** au build, base CI joignable, `/bio` affiche « Oh My Cot », accueil redirigé vers `/bio`, `/admin` répond |
| Variables | 8 réglées ; clés Supabase et secrets passés par l'entrée standard de la CLI Railway, jamais affichés |
| `ohmycot-cron-cash` | Créé, toutes les 15 min, `APP_URL` et `CRON_SECRET` par référence au service `ohmycot` ; premier passage : succès |

**Quand la branche sera fusionnée dans `main`**, repasser la source de `ohmycot` sur `main`. Sinon le service ivoirien continuera de suivre la branche de travail.

## 5. Constat en production (Gabon)

**Les relances de paiement en espèces ne partent plus.** Depuis au moins le 24 septembre au matin, chaque passage de `cron-cash` (toutes les 15 min) reçoit **401 Non autorisé** et finit en « CRASHED ». `cron-catalog-drip`, avec la même vérification, passe bien. La valeur de `CRON_SECRET` enregistrée sur `cron-cash` diffère donc de celle du site (non lue ici).

**Corrigé le 24 septembre (« go G1 »)** : la variable `CRON_SECRET` de `cron-cash` vaut désormais la référence `${{twinsk.CRON_SECRET}}` et suit toujours celle du site. Le premier passage après la correction se termine en succès, après une série de 401.
