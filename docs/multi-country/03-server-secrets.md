# Phase 3 — Secrets, adresses d’appel et noms d’expéditeur

> Branche `feat/multi-country`, 24 septembre 2026.

## 1. Fonctions Edge : sans objet

Le projet n’a **aucune fonction Edge** (constaté en phase 0 : `supabase/functions/` absent, aucune fonction déployée). Toute la logique serveur tourne dans les routes API Next.js, hébergées sur Railway. La phase porte donc sur ces routes.

`supabase/.env.example` existe mais ne déclare aucun secret, et l’étape `supabase secrets set` de la phase 6 est sans objet tant qu’aucune fonction Edge n’est ajoutée. Si l’on en ajoute une, elle lira le pays avec `Deno.env.get('COUNTRY')`.

## 2. Variables par composant

État relevé sur le service Railway `twinsk` (Gabon) le 24 septembre 2026 : noms seulement, aucune valeur lue.

| Composant | Variables | Par pays ? | Gabon (prod) |
|---|---|---|---|
| Pays et domaine | `NEXT_PUBLIC_COUNTRY`, `NEXT_PUBLIC_SITE_URL` | oui | absentes (Gabon par défaut, domaine de `COUNTRY`) |
| Base de données | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | oui | présentes |
| Accès admin, sessions équipe | `ADMIN_PASSWORD` | oui | présente |
| Tâches planifiées | `CRON_SECRET` | oui | présente (service web + 2 services cron) |
| WhatsApp (WHAPI) | `WHAPI_TOKEN`, `WHAPI_WEBHOOK_SECRET` | oui | présentes |
| WhatsApp : groupes | `WHAPI_GROUP_ID`, `WHAPI_ORDERS_GROUP_ID`, `WHAPI_STAFF_GROUP_ID` | oui | **absentes** : les deux premières retombent sur `COUNTRY.whatsappGroups` ; sans la troisième, l’équipe n’est pas prévenue d’une réservation en espèces |
| WhatsApp : numéros | `NEXT_PUBLIC_OMG_WHATSAPP_NUMBER`, `ADMIN_WHATSAPP_NUMBER` | oui | absentes (repli : `COUNTRY.supportWhatsapp`) |
| WHAPI : adresse de l’API | `WHAPI_BASE_URL` | non | absente (défaut `https://gate.whapi.cloud`) |
| Paiement | `AIRTEL_MONEY_NUMBER` | Gabon seulement (CI : phase 4) | présente |
| Tarifs de fret | `AIR_RATE_FCFA_PER_KG`, `AIR_BATTERY_RATE_FCFA_PER_KG`, `AIR_MAX_UNIT_VOLUME_M3`, `SEA_RATE_FCFA_PER_M3`, `SEA_RATE_FLOOR_FCFA_PER_M3` | oui (facultatives) | absentes (défauts de `COUNTRY.freight`) |
| Facebook / Instagram | `META_PAGE_ID`, `META_PAGE_TOKEN`, `META_IG_USER_ID` | oui | présentes |
| Alertes Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | à décider | **nom incorrect** : la prod définit `TELEGRAM_TOKEN`, le code lit `TELEGRAM_BOT_TOKEN` → alertes muettes. Sans `TELEGRAM_CHAT_ID`, repli sur `@twinskdaily` |
| Sourcing et traduction | `RAPIDAPI_KEY`, `KIMI_API_KEY` | non (partageables) | présentes |
| Planificateur interne | `DRIP_INTERNAL_SCHEDULER` | non | absente (planificateur actif) |

## 3. Adresses d’appel

| Appel | Construction | Pour la Côte d’Ivoire |
|---|---|---|
| Webhook WHAPI (messages, accusés, paniers, votes) | `https://<domaine>/api/whapi/webhook?secret=<WHAPI_WEBHOOK_SECRET>`, enregistré par le bouton « Configurer le webhook » (`/admin/whatsapp` › Envoyer) à partir de l’adresse de la page | Cliquer le bouton depuis l’admin ivoirien, avec le canal WHAPI du numéro ivoirien |
| Diffusion horaire | Service Railway `cron-catalog-drip`, boucle horaire : `curl "https://twinsk-production.up.railway.app/api/cron/category-drip?key=$CRON_SECRET"` | Service équivalent, adresse **paramétrée** (voir ci-dessous) |
| Relances de paiement en espèces | Service Railway `cron-cash`, toutes les 15 min : `curl "https://twinsk-production.up.railway.app/api/cron/cash-reminders?key=$CRON_SECRET"` | Idem |
| Planificateur interne | `instrumentation.ts` → `PUBLIC_ORIGIN_FALLBACK` = `NEXT_PUBLIC_SITE_URL`, sinon `https://${COUNTRY.domain}` | Automatique |
| Liens envoyés aux clients et à l’équipe | `publicOrigin(request)` (en-têtes du proxy), sinon `PUBLIC_ORIGIN_FALLBACK` | Automatique |
| Paiement en ligne | Aucun aujourd’hui | Phase 4 : adresse de retour construite avec `publicOrigin` |

**Services cron de la Côte d’Ivoire (phase 7).** Plutôt que d’écrire le domaine en dur, chaque service cron ivoirien reçoit une variable qui référence le service web :

```bash
APP_URL=https://${{ohmycot.RAILWAY_PUBLIC_DOMAIN}}
```

et sa commande devient :

```bash
curl -fsS "$APP_URL/api/cron/cash-reminders?key=$CRON_SECRET"
```

Les services cron du Gabon ne sont pas modifiés (ce serait une écriture chez l’hébergeur). Les passer au même modèle serait une amélioration à faire avec votre accord.

## 4. Noms d’expéditeur

| Où | Avant | Maintenant |
|---|---|---|
| Messages clients (réservation en espèces) | « — TWINSK » | `COUNTRY.senderName` : « TWINSK » au Gabon, « Oh My Cot » en CI |
| Code de connexion des agents (WhatsApp) | « TWINSK — Espace agents » | idem |
| Titre et en-tête de l’espace agents, titre de l’admin | « TWINSK », « TWINSK Admin » | idem |
| Messages mentionnant la marque | « Oh My Gab » | `COUNTRY.brand` (phase 2) |

## 5. Corrections incluses (à valider)

| Correction | Effet au Gabon |
|---|---|
| **10 routes construisaient leurs liens avec `request.nextUrl.origin`**, qui désigne derrière Railway l’adresse interne du conteneur (`https://0.0.0.0:8080`, comportement documenté dans `public-origin.ts`). Elles passent à `publicOrigin(request)`, comme les 18 autres routes | Liens publics fiables dans : récapitulatif après réservation en espèces, relances de paiement, notifications du groupe « Commandes », lien partenaire, fiche produit, paniers reçus du catalogue WhatsApp (qui appelaient aussi l’API interne par cette adresse). Non constaté dans les messages enregistrés : la messagerie ne les conserve que depuis le 23 septembre |
| Identifiants des groupes WhatsApp (principal, « Commandes », « Oh My Recherche ») déplacés dans `COUNTRY.whatsappGroups` | Aucun (mêmes valeurs) ; en CI, plus de risque d’écrire dans les groupes du Gabon |
| Variable Telegram mal nommée | **Non corrigée** : la corriger réactiverait des alertes ; à décider |
