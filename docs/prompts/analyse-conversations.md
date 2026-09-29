# Prompt : analyse IA des conversations WhatsApp (Oh My Gab / Oh My 225 !)

À coller tel quel dans une session Claude Code ouverte sur ce dépôt. Rédigé le 29/09/2026 à partir de l'état réel du code (adapté d'un prompt écrit pour une autre plateforme).

Tu travailles sur **Twinsk / Oh My Gab / Oh My 225 !** : Next.js 16 (App Router), Supabase, déployé sur Railway depuis `FranckSowax/twinsk` branche `main`. **Un déploiement et une base par pays** : Gabon (GA) et Côte d'Ivoire (CI). Avant toute chose : `git pull`, `npm ci`, puis lis `CLAUDE.md`, `docs/multi-country/README.md` et le contexte « messagerie » ci-dessous.

## Mission

Construire un système d'analyse IA des conversations WhatsApp **privées** reçues sur le numéro de chaque pays, pour un commerce d'import depuis la Chine :
- deux types de listings : maison (B2C) et business clé en main (B2B, par exemple pizzeria ou bar à ongles) ;
- prix affichés en FCFA ;
- transport aérien (8-14 j) ou maritime (60-85 j), éventuellement fractionné ;
- paiement mobile money ou espèces à l'agence ;
- livraison à domicile ou retrait à l'agence.

Les clients arrivent surtout par des pubs Meta « Envoyer un message WhatsApp » (84 % des conversations au 29/09).

**Il n'y a pas de chatbot** : ce sont des humains qui répondent. Ils répondent depuis `/admin/inbox` (admin, collaborateurs), depuis `/agent` (agents), ou directement depuis le téléphone, hors plateforme (la moitié des réponses au 29/09).

L'analyse sert trois choses :
- dire à l'équipe quoi faire maintenant, conversation par conversation ;
- relancer les clients chauds ;
- produire un rapport quotidien orienté ventes.

## État actuel, à lire en entier avant de coder

- **Messagerie** (migrations 59 à 61, intégrées à `supabase/migrations/20260924000000_baseline_ga.sql`) :
  - `wa_conversations` : `id, chat_id, phone, name, status open|replied|closed, unread_count, last_message_at, last_inbound_at, last_outbound_at, assigned_to, assigned_name, note, source jsonb (pub d'origine : type ad|direct, title, ad_id, url), last_outbound_status` ;
  - `wa_messages` : `id, conversation_id, chat_id, from_me, type, text, media_url, media_kind, filename, sender_name, sent_by ('admin' | id collaborateur ou agent | null = téléphone), sent_at, status, context jsonb (context.ad : pub d'origine avec body ; context.quoted ; context.buttons : fiches envoyées par la plateforme)`.
- **Code de la messagerie** :
  - `src/lib/wa-inbox.ts` (pur, testé : `describeMessage`, `conversationPatch`, `summarizeThread`, `isCourtesyOnly`) ;
  - `src/lib/wa-inbox-data.ts` (ingestion webhook, `sendInboxReply`, `recordOutboundMessages`, `syncConversationHistory`, épingles) ;
  - interface : `src/components/inbox/InboxPage.tsx` (utilisée par `/admin/inbox` et `/agent`, identité via `src/lib/inbox-actor.ts`).
- **Commandes, la vérité terrain** : `offer_orders` (`client_phone, offer_id, payment_status pending|submitted|paid, transport_mode air|sea|mixed|null, items_total_fcfa, grand_total_fcfa, created_at`) et `offer_order_lines`. Le rattachement à une conversation se fait par le numéro normalisé (`phone` côté conversation, chiffres seuls de `client_phone`). Les sélections client sont dans `wa_settings` clé `client_selection:<id>` (`src/lib/client-selection.ts`).
- **Listings** : `offers` et `offer_products`. Le rattachement conversation → listing existe déjà dans `src/lib/admin-activity.ts` (`conversationOrigin` : lien `/offer/<id>` dans le texte de la pub, sinon premier lien de listing échangé). Réutilise-le, ne le recode pas.
- **Tableau de bord** : `src/components/admin/ActivityDashboard.tsx` et `GET /api/admin/stats/activity?period=7|30|90|all` (temps de réponse, entonnoir, par listing). Le rapport d'analyse s'y ajoute, il ne le remplace pas.
- **Pays** : jamais de valeur propre à un pays en dur. Passe par :
  - `COUNTRY` (`src/config/countries.ts` : `currency`, `mainCity`, `paymentProviders`, `transit`, `timezone`, `brand`) ;
  - `CONTENT` (`src/content/<PAYS>/`) ;
  - `formatPrice` et `hourInCountry` (`src/lib/country.ts`) ;
  - `normalizePhone` (`src/lib/phone.ts`).
- **IA existante** : uniquement `src/lib/kimi/api.ts` (Moonshot, appel HTTP direct, traduction chinois → français, `KIMI_API_KEY`). Il n'existe pas de couche LLM générique ni de journal de consommation.
- **Tâches planifiées** : services cron Railway (image `curlimages/curl`) qui appellent `/api/cron/<nom>?key=$CRON_SECRET`, avec `APP_URL` et `CRON_SECRET` par référence (modèle : `src/app/api/cron/cash-reminders`, `docs/multi-country/07-deploy.md`). Pas de pg_cron.
- **Réglages sans migration** : `wa_settings` (clé → jsonb). Les phrases rapides sont dans `inbox_quick_replies`.

## Décisions à faire valider par Franck AVANT de coder (s'arrêter et demander)

1. **Fournisseur LLM** :
   - (a) Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via l'API Anthropic. Recommandé pour le français et le JSON strict. Il faut une clé `ANTHROPIC_API_KEY` que Franck ajoute lui-même dans Railway, pour les deux services.
   - (b) Kimi, avec la clé déjà en place.

   Le code passe par une couche unique (voir contrainte 3). Changer de fournisseur = une variable d'environnement.
2. **Données personnelles** : les dialogues partent chez le fournisseur. Proposer de masquer numéros et e-mails (remplacés par `[numéro]`) et de ne pas envoyer le nom du client.
3. **Fréquence** : analyse toutes les heures des conversations modifiées, rapport à 21 h (heure du pays). La création des services cron Railway demande l'accord de Franck.

## Ce que doit produire l'analyse, par conversation

Le LLM répond en JSON strict, validé champ par champ contre des listes fermées. Une valeur inconnue est ramenée au défaut, et une réponse partielle ou malformée ne fait jamais planter le traitement.

**Champs génériques**
- `sentiment` : POSITIVE | NEUTRAL | NEGATIVE ;
- `urgencyLevel` : LOW | MEDIUM | HIGH ;
- `resolutionStatus` : RESOLVED | PENDING | UNRESOLVED ;
- `satisfactionScore` : 0-100 ;
- `customerNeedSummary` : une phrase en français ;
- `topicTags` : 0 à 5 mots-clés ;
- `language` : fr | en | autre.

**`intentCategory`**
- PRODUCT_QUESTION, PRICE_QUESTION, PRICE_NEGOTIATION ;
- AVAILABILITY_VARIANT (stock, couleur, taille, variante) ;
- TRANSPORT_QUESTION (avion ou bateau, délais, coût du fret) ;
- ORDER_PLACEMENT, PAYMENT (comment payer, preuve de paiement), ORDER_STATUS (où en est l'envoi) ;
- **SOURCING_REQUEST** (produit absent du catalogue) ;
- **B2B_PROJECT** (projet clé en main, devis, aménagement) ;
- COMPLAINT, AFTER_SALES, PROMOTION_INQUIRY, GENERAL.

**`purchaseStage`** : BROWSING, CONSIDERING, READY_TO_BUY, ORDERED, POST_PURCHASE, LOST.
- **Corrigé par les faits** après l'appel LLM : une commande `paid` du même numéro donne au moins ORDERED ; `submitted` donne au moins READY_TO_BUY.
- Garder à côté `llmStage` (l'avis du modèle) et `factStage` (déduit des commandes), pour mesurer l'écart.

**Intention et produits**
- `purchaseIntentScore` : 0-100.
- `productsMentioned` : 0 à 5 éléments `{ label, quantity?, priceMentioned? }`, libellés tels que le client les nomme (pas de liste fermée : le catalogue change chaque semaine). Montants dans la devise du pays (`COUNTRY.currency`), jamais « XAF » en dur.
- `listingId` : listing rattaché, par `conversationOrigin`, pas par le LLM.

**Freins et modalités**
- `objections`, parmi :
  - PRICE, TRANSPORT_COST ;
  - TRANSIT_DELAY (délai du bateau ou de l'avion) ;
  - TRUST (payer avant de recevoir un import) ;
  - PAYMENT_METHOD, STOCK, MOQ (quantité minimale) ;
  - QUALITY_DOUBT, SIZE_FIT ;
  - NONE.
- `transportPreference` : AIR | SEA | MIXED | UNKNOWN.
- `paymentMethodMentioned` : MOBILE_MONEY | CASH_AGENCY | CARD | BANK_TRANSFER | NONE. Libellés du pays tirés de `COUNTRY.paymentProviders` : Airtel au Gabon, Orange/MTN/Wave/Moov en CI.
- `deliveryZone` : texte court (quartier ou ville), ou null.

**Suite à donner**
- `abandonRisk` : LOW | MEDIUM | HIGH, plus `abandonReason` si HIGH.
- `upsellOpportunity` : texte court ou null (par exemple un four pour un client pizzeria).
- `nextBestAction`, relié aux outils qui existent déjà dans la messagerie :
  - SEND_LISTING (lien du listing ou /bio) ;
  - SEND_SELECTION (onglet « Sélection client ») ;
  - CREATE_CART (panier client) ;
  - SEND_QUOTE (devis) ;
  - SEND_PAYMENT_INSTRUCTIONS, CONFIRM_TRANSPORT ;
  - SOURCING_REQUEST, FOLLOW_UP_24H, ESCALATE_ADMIN ;
  - NONE.

  Plus `nextBestActionNote` en français, une phrase directement utilisable.
- **`teamGaps`**, qui remplace les « questions auxquelles le bot n'a pas su répondre » (il n'y a pas de bot) : questions du client restées sans réponse, ou auxquelles l'équipe a répondu de façon vague. Chacune sous forme `{ question, suggestedAnswer? }`. Elles remontent au rapport pour créer ou corriger des **phrases rapides** (`inbox_quick_replies`) et la FAQ des listings.

**Métadonnées techniques**
- `analyzedAt`, `lastMessageId` analysé, `messageCount`, `model`, `inputTokens`, `outputTokens`, `costFcfa`.

## Rapport quotidien

Un rapport par jour et par pays (fuseau `COUNTRY.timezone`), qui reprend :
- conversations analysées ;
- répartition par `purchaseStage` et par `intentCategory` ;
- top 10 des produits demandés (fréquence, en signalant ceux demandés sans réponse) ;
- **produits demandés absents du catalogue** (SOURCING_REQUEST) : idées de nouveaux listings ;
- objections les plus fréquentes, **par listing et par pub d'origine** ;
- **chiffre d'affaires en suspens** calculé sur les faits : somme des `grand_total_fcfa` (sinon `items_total_fcfa`) des paniers `pending` avec transport choisi, plus les estimations LLM des conversations READY_TO_BUY sans panier, **les deux montants affichés séparément** ;
- taux de conversations à risque d'abandon élevé ;
- zones de livraison demandées ;
- `teamGaps` regroupés, avec la phrase rapide suggérée pour chacun ;
- relances à faire : liste des conversations chaudes sans réponse depuis plus de 24 h ;
- un paragraphe de recommandations orientées ventes (relances, listings à pousser ou à retirer, prix contestés, pubs à ajuster).

Le prompt du rapport reçoit des **statistiques déjà agrégées**, jamais les dialogues bruts.

## Contraintes non négociables

1. **Pays, pas de profils multi-clients.** Une seule taxonomie « commerce », déclarative, dans `src/lib/conversation-analysis/taxonomy.ts` : valeurs, libellés français, défauts, fragment de prompt, règles d'agrégation. Les valeurs propres au pays (devise, moyens de paiement, ville, délais) sont injectées depuis `COUNTRY`. Aucun `if (pays)` dans le service. Le module doit tourner à l'identique au Gabon et en Côte d'Ivoire.
2. **Schéma par migration, non destructif** : `supabase migration new conversation_analysis`. Contenu :
   - table `wa_conversation_analyses` (une ligne par analyse, historique conservé, champs génériques en colonnes, bloc commerce en `jsonb`) ;
   - colonnes dénormalisées indexées sur `wa_conversations` : `purchase_stage`, `purchase_intent_score`, `abandon_risk`, `next_best_action`, `analyzed_at` (pour filtrer et trier dans la messagerie) ;
   - table `wa_daily_reports` (unique par jour : compteurs, `breakdown jsonb`, `insights`, `recommendations`) ;
   - RLS activée sans politique, comme les autres tables.

   Test local, puis fusion dans `main`. Le workflow `migrate-all-countries` applique en CI puis au Gabon **après approbation de Franck**. Tant que la migration n'est pas appliquée, le code doit tourner sans erreur (lecture `select('*')`, écritures tolérantes, message « migration non appliquée » dans l'interface).
3. **Couche IA unique** `src/lib/llm.ts` :
   - `chatCompletion({ system, messages, jsonMode, maxTokens, timeoutMs })` ;
   - `parseJsonLoose` ;
   - retry sur 429 et 5xx ;
   - fournisseur choisi par `ANALYSIS_LLM_PROVIDER`, modèle par `ANALYSIS_MODEL` ;
   - consommation journalisée (tokens et coût en FCFA) dans la ligne d'analyse, et agrégée dans le rapport.

   Pas de nouvel appel HTTP direct ailleurs. Kimi peut rester tel quel pour la traduction.

   Seuils :
   - pas d'analyse en dessous de **2 messages client** ;
   - pas d'analyse si le dernier message date de moins de **30 min** (conversation en cours) ;
   - pas de ré-analyse si aucun nouveau message depuis `lastMessageId` ;
   - prompt système sous 1 500 tokens hors dialogue ;
   - dialogues tronqués en gardant les **30 derniers messages**, en conservant le premier message (souvent la pub d'origine) ;
   - plafond par passage (`ANALYSIS_BATCH_LIMIT`, 40 par défaut) et plafond de coût par jour (`ANALYSIS_DAILY_BUDGET_FCFA`).
4. **Format du dialogue envoyé** : une ligne par message, `[client]` ou `[équipe]` suivi de l'heure locale et du texte. Pour les médias : `[photo]`, `[vocal]`, `[document : nom]`. Les fiches produit envoyées par la plateforme apparaissent comme `[fiche : titre + boutons]`. Le résumé de la pub d'origine (titre, lien du listing) va en tête. Numéros de téléphone et e-mails masqués (décision 2).
5. **Messagerie (`/admin/inbox` et `/agent`)** :
   - **Liste des conversations** : badges « Stade », « Intention » (score) et « Risque » ; filtre « Clients chauds » (READY_TO_BUY ou intention ≥ 70, sans réponse ou sans panier) ; tri par intention.
   - **En-tête du fil** : un volet « Analyse » repliable, avec le résumé du besoin, les objections, la zone et la **prochaine action**. Cette action est un bouton qui ouvre l'outil existant : panier, sélection, phrase rapide pré-remplie, lien du listing. Bouton « Ré-analyser » à côté (POST, protégé par `inboxActor`).
   - Aucun libellé en dur : tout vient de la taxonomie (module pur partagé client et serveur).
   - Les agents voient l'analyse de leurs conversations, comme le reste.
6. **Tableau de bord** : section « Analyse des conversations » dans `ActivityDashboard`, avec le même sélecteur 7 j / 30 j / 90 j / tout :
   - stades et intentions ;
   - produits demandés et demandes hors catalogue ;
   - objections par listing ;
   - CA en suspens (faits et estimations) ;
   - `teamGaps` avec un bouton « Créer la phrase rapide » (admin seulement) ;
   - dernier rapport quotidien lisible.
7. **Tâches planifiées** :
   - `GET /api/cron/conversation-analysis?key=` : analyse par lots ;
   - `GET /api/cron/conversation-report?key=` : rapport du jour, idempotent (upsert par date).

   Services Railway `cron-conversation-analysis` et `ohmycot-cron-conversation-analysis`, sur le modèle de `cron-cash` (`APP_URL` et `CRON_SECRET` par référence), **créés seulement après accord de Franck**.
8. **Tests** (Vitest, sans base ni réseau) :
   - validation d'une réponse LLM complète, partielle et malformée ;
   - correction du stade par les faits (commande payée, engagée, aucune) ;
   - masquage des numéros ;
   - troncature du dialogue ;
   - seuils (moins de 2 messages client, conversation en cours, rien de nouveau) ;
   - agrégations du rapport sur un jeu de conversations fictif ;
   - calcul du CA en suspens ;
   - regroupement des `teamGaps`.

   Le fournisseur LLM est simulé. `npm test`, `npm run lint`, `npx next build` puis `NEXT_PUBLIC_COUNTRY=CI npx next build` doivent être verts, et le nombre de tests ne doit pas baisser.
9. **Règles du dépôt** (`CLAUDE.md`) :
   - aucune écriture manuelle sur la base du Gabon (lecture seule pour l'assistant ; Franck lance lui-même ce qui doit l'être) ;
   - aucune écriture distante sans accord explicite ;
   - aucun secret affiché ni commité ;
   - WhatsApp de test uniquement vers le numéro de Franck ;
   - `git add` explicite ; synchroniser le dossier du Bureau après chaque push.

## Vérification réelle

Il n'y a pas d'endpoint de test du chatbot : on vérifie sur des conversations réelles, **sans rien écrire** d'abord.

1. **Avant déploiement** : un script `scripts/analysis-dry-run.ts` lit trois conversations réelles du Gabon (lecture seule) et affiche le JSON d'analyse, les tokens et le coût en FCFA, sans rien enregistrer. Les trois conversations :
   - une question de prix venue de la pub Canapés ;
   - un client pizzeria qui a créé un panier ;
   - une conversation avec une plainte ou un retard.

   Montrer les trois JSON à Franck.
2. **Après approbation de la migration et déploiement** : lancer « Ré-analyser » sur ces trois conversations depuis la messagerie, vérifier les badges et le volet, générer le rapport du jour et montrer l'écran du tableau de bord.
3. **Logs Railway** : lecture par l'outil Railway (service `twinsk` ou `ohmycot`), en cherchant `[analysis]`.

## Livrables

- **Code, migration et tests, en commits séparés**, dans cet ordre :
  1. taxonomie et couche LLM ;
  2. service et validation ;
  3. migration et dénormalisation ;
  4. rapport ;
  5. routes et cron ;
  6. messagerie ;
  7. tableau de bord.
- **`docs/whatsapp/analyse-conversations.md`** :
  - fonctionnement ;
  - comment ajouter ou modifier une catégorie ;
  - **coût moyen par conversation analysée en FCFA**, mesuré sur les trois conversations du test à blanc ;
  - coût mensuel estimé : environ 300 analyses par mois au 29/09 (225 conversations, 1 255 messages sur un mois) ;
  - ce qui part chez le fournisseur LLM.
- **Mémoire du projet** mise à jour, et un récapitulatif en français à Franck : ce qui a été vérifié en production, ce qui reste ouvert.

**Ne commence pas par l'interface.** Ordre : taxonomie → couche LLM → service et validation → migration → rapport → routes et cron → messagerie → tableau de bord → vérification réelle. À chaque étape, dis ce que tu as vérifié et comment.
