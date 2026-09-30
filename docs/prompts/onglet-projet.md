# Prompt : onglet « Projet » (suivi client d'un programme d'équipement)

À coller tel quel dans une session Claude Code ouverte sur ce dépôt. Rédigé le 30/09/2026 à partir de l'état réel du code, en adaptant un cahier des charges écrit pour le programme « PSG Academy DOM-TOM » (complexes sportifs : terrains de foot five, padel, conteneurs bar, options couverture et tribunes, sur 4 territoires : Martinique, Guadeloupe, Guyane, La Réunion ; sourcing en Chine, transport maritime, installation supervisée).

Tu travailles sur **Twinsk / Oh My Gab / Oh My 225 !** : Next.js 16 (App Router), Supabase, déployé sur Railway depuis `FranckSowax/twinsk` branche `main`, un déploiement et une base par pays. Avant toute chose : `git pull`, `npm ci`, puis lis `CLAUDE.md` et `docs/multi-country/README.md`.

## Mission

Ajouter au **tableau de bord Twinsk uniquement** (module `COUNTRY.modules.twinsk`, donc Gabon, jamais Oh My 225 !) un onglet **« Projets »** : le suivi, partagé avec le client, d'un programme d'équipement clé en main. Le premier projet est PSG Academy DOM-TOM, mais l'outil doit servir à tout projet du même genre (une usine, un hôtel, une chaîne de restaurants).

Un projet réunit :
- un **plan d'action** par étapes, avec tâches, sous-tâches à cocher, pièces jointes et commentaires ;
- un **journal** de mises à jour publié par l'équipe, que le client peut commenter ;
- des **questions** du client, traitées comme des tickets avec délai de réponse ;
- des **documents** partagés par catégorie ;
- un **devis consolidé** par lot, que le client valide ligne par ligne, et dont les lignes validées deviennent des **commandes** suivies par étapes ;
- un **rapport final** et une proposition de **voyage d'audit en Chine**.

## Ce qui existe déjà, et comment le réutiliser

| Besoin | Brique existante | Décision |
|---|---|---|
| Accès du client sans compte | Lien à jeton de `sourcing_shares` (`src/app/api/sourcing/projects/[id]/shares/route.ts` : jeton aléatoire, expiration, révocation, compteur de vues, projection publique filtrée avec test `src/lib/sourcing/publicProjection.ts`) | **Reprendre ce modèle** : un lien par personne côté client, révocable, page publique `/projet/<jeton>`. Pas de compte client. |
| Le client accepte ou demande des changements | `freight_requests.client_decision` + route `client-action` (`src/app/api/freight-requests/[uuid]/client-action`) | Modèle pour la validation d'une ligne de devis |
| Le client choisit quantités et variantes | `/proposal/[uuid]` (`ProposalView`, `client_selected`, `client_quantity`, route `submit`) | Modèle d'interface pour les quantités éditables du devis |
| Devis PDF | `src/components/quote/QuotePDF.tsx`, `src/lib/pdf/fonts.ts`, `src/app/api/quotes/[quoteId]/pdf/route.ts` (`@react-pdf/renderer`) | Copier le gabarit (logo, polices) pour le PDF du devis projet et du rapport final |
| Devis figé quand il devient facture | `quote_snapshot` (`src/lib/quote-data.ts`) | Même idée : une ligne validée est figée (prix, quantité, horodatage) |
| Stepper de statuts | `PipelineStrip` / `StageChip` (`src/components/agent/agent-ui.tsx`), `wa_departures` (jalons de départ) | Réutiliser pour le suivi des commandes projet |
| Checklist avec preuve | `sourcing_conditions` (état oui/non, `evidence`) | Modèle des sous-tâches |
| Journal daté | `sourcing_contact_log`, `playbook_log` | Modèle du journal de projet |
| Notifications équipe | `src/lib/telegram.ts` (`sendTelegramMessage`) | Alerte équipe : question client, validation, dépôt de document, mise à jour du jour non publiée |
| Notifications client | WhatsApp via `sendWhapiText`, modèle `src/lib/order-status-notify.ts`, numéro réel via `resolveWhatsappChatId` (`src/lib/whatsapp-number.ts`) | Message au client : mise à jour, réponse, demande de validation, changement de statut, jalon logistique. **Uniquement si le client a donné un numéro WhatsApp** ; sinon rien (pas d'e-mail dans l'app). |
| Traçabilité | `logCollabAction` (`src/lib/collab.ts`) | Étendre : journaliser aussi les actions admin et client dans une table d'audit du projet |
| Rôles équipe | `src/lib/collab-roles.ts` (`production`, `commandes`, `sourcing`, `whatsapp`) | Rôles `production` et `sourcing` accèdent aux projets, plus l'admin |
| Envoi de fichiers | `/api/upload` (bucket public `request-images`, images et mp4 seulement, PDF refusé) | **Ne pas réutiliser pour les documents de projet** : nouvelle route avec bucket **privé** `project-files` et liens signés (plans, contrats, PDF). Les images de tâches peuvent passer par `/api/upload`. |
| Onglet admin réservé à Twinsk | `NAV_ITEMS` (`src/app/admin/layout.tsx`), `TWINSK_ADMIN_PREFIXES` / `TWINSK_PUBLIC_PREFIXES` (`src/lib/modules.ts`), matcher de `src/proxy.ts`, clés `fr` et `zh` dans `src/lib/i18n/admin.ts` | Ajouter `/admin/projets` et `/projet` aux deux listes et au matcher |

**À ne pas réutiliser** : la table `quotes` (devis de sourcing en CNY calculés depuis `search_results`) et `offer_orders` (commandes B2C en FCFA). Le devis projet et ses commandes ont leur propre modèle, en **euros**.

**Pièges connus du dépôt** :
- `collaborators.role` : la contrainte de la base n'autorise pas `whatsapp` alors que le code l'utilise. Ne pas ajouter de rôle sans migration qui corrige cette contrainte.
- `TELEGRAM_TOKEN` est mal nommé sur Railway au Gabon (le code lit `TELEGRAM_BOT_TOKEN`) : les alertes Telegram sont muettes tant que Franck n'a pas renommé la variable. Le code doit fonctionner sans.
- Les images de `/api/upload` sont **publiques** : n'y mettre aucun document confidentiel.

## Décisions à faire valider par Franck AVANT de coder (s'arrêter et demander)

1. **Accès client** : lien à jeton par personne (recommandé, cohérent avec le reste de l'app), ou code OTP WhatsApp comme les agents.
2. **Bucket privé** `project-files` : sa création dans Supabase Gabon est une écriture distante (via `scripts/supabase/buckets.ts` + `recreate-buckets.ts --apply`, lancé par Franck).
3. **Notifications client** : WhatsApp seulement, rien par e-mail.
4. **Devise** : euros pour les projets hors zone franc (DOM-TOM), avec la devise choisie à la création du projet.
5. **Chargement des données PSG** : par un bouton « Créer depuis le modèle DOM-TOM » dans l'interface (le modèle est du code déclaratif), pas par script SQL.

## Règle n° 1 : confidentialité des fournisseurs

Les noms d'usines ne doivent **jamais** apparaître côté client :
- alias **« Fournisseur A », « Fournisseur B »…** par lot ;
- prix d'achat masqués ; seuls les **prix de vente** sont visibles ;
- bandeau permanent côté client : « Fournisseurs anonymisés jusqu'à signature des accords-cadres (NDA) » ;
- le rapprochement alias → fournisseur réel vit dans une table lue seulement par les routes admin ;
- **projection publique filtrée champ par champ**, avec un test qui échoue si un champ interdit (`supplier_name`, `unit_cost`, `factory_*`) sort par la route publique, comme `publicProjection.test.ts` du sourcing.

## Modèle de données (une migration, non destructive, RLS activée sans politique)

- `projects` : titre, client (nom, entreprise, WhatsApp, e-mail), devise, statut (`draft`, `active`, `closed`), phases (jsonb : nom, territoire, ordre, verrouillée tant que la précédente n'est pas réceptionnée), durées de référence (jsonb : transit par destination, production, visas, cure), `created_by`.
- `project_shares` : jeton, `person_name`, `role_label`, `expires_at`, `revoked_at`, `views`.
- `project_steps` : ordre, titre, description, phase ; `project_tasks` : étape, titre, description, responsable (`team` | `client`), échéance relative (semaines) et absolue calculée, statut, checklist (jsonb : items cochés), `locked` ; `project_task_comments` (auteur `team` | `client`, texte, pièces jointes).
- `project_updates` (journal) : date, titre, corps, pièces jointes ; `project_update_comments`.
- `project_questions` : objet, détail, pièce jointe, statut (`open` | `answered`), `answered_at`, réponses (`project_question_replies`). Délai affiché : « réponse sous 24 h ouvrées ».
- `project_documents` : catégorie (`site` plans et photos, `technical`, `admin`, `reports`, `misc`), chemin dans le bucket privé, taille, auteur, date.
- `project_suppliers` : lot, alias, nom réel, contact (jamais exposé).
- `project_quote_lines` : lot, désignation, unité, quantité proposée, quantité client, prix de vente unitaire, `optional`, `enabled`, statut (`draft` | `validated` | `ordered`), `validated_at`, `validated_by`, `unit_cost` (masqué côté client).
- `project_orders` : lignes rattachées, statut du stepper `validated → issued → deposit_secured → production → inspection → shipped → in_transit → delivered`, `tracking`, photos hebdo de production dans les pièces jointes.
- `project_events` (audit + notifications) : type, acteur (`admin` | collaborateur | `client:<share>`), cible, détail, `notified_client_at`, `notified_team_at`.

## Fonctionnalités

1. **Plan d'action généré depuis un modèle** (`src/lib/projects/templates/dom-tom.ts`, déclaratif) : 8 étapes, de « Cadrage et validation client » à « Montage, supervision et réception », tâches avec responsable, échéance relative, checklist. Les échéances absolues sont calculées depuis la date de lancement et les durées de référence (transit Chine → Antilles 40–55 j, Réunion 25–38 j, Guyane 50–70 j ; production 3–6 semaines ; visas techniciens 4–8 semaines ; cure dalle padel 28 j). Le modèle DOM-TOM pré-remplit les quantités du programme (gazon ~5 800 m², shockpad ~4 800 m², 8 kits cages, 128 projecteurs LED + 32 mâts, 8 kits padel, 4 conteneurs bar, options tribunes et membrane ~6 400 m²) et les 4 territoires en deux phases.
2. **Tâches** : case à cocher (une tâche « validation client » ne peut être soldée que par le client), fenêtre de détail avec checklist, pièces jointes (images par `/api/upload`, documents par la nouvelle route privée), commentaires équipe ↔ client horodatés, « Marquer terminée / rouvrir », barres de progression par étape et globale. Les tâches d'une phase verrouillée sont visibles mais grisées.
3. **Journal** : fil antichronologique, une entrée par jour ouvré attendue ; l'appel de cron quotidien (modèle `src/app/api/cron/cash-reminders`, service Railway `curlimages/curl` avec `sh -c` et `CRON_SECRET` en en-tête) alerte l'équipe sur Telegram si rien n'a été publié la veille ; le client commente ; notification WhatsApp au client à chaque entrée.
4. **Questions** : formulaire client (objet, détail, pièce jointe), ticket `open` → `answered`, délai affiché, historique.
5. **Documents** : bibliothèque par catégorie, envoi multiple, suppression, métadonnées.
6. **Devis consolidé** ⭐ : lignes groupées par lot ; quantité modifiable par le client ; options activables ; « Valider pour commande » par ligne (figée, horodatée, tracée) ; annulation possible tant qu'aucune commande n'est émise ; « Passer en commande » sur les lignes validées → `project_orders` avec stepper ; chaque changement de statut crée une entrée de journal et une notification. Trois totaux : validé ou commandé, en attente, programme estimé. Mention permanente : « Prix indicatifs, hors octroi de mer et taxes locales — fournisseurs anonymisés ». PDF du devis sur le gabarit `QuotePDF`.
7. **Rapport final** par phase (checklist du contenu : DOE, tests de réception, garanties, manuel FR, bilan vs devis) ; « Remis à la réception » → PDF téléchargeable. **Voyage d'audit** : programme sur 5 jours pré-rempli, boutons client « Je suis intéressé » et « Recevoir le devis du voyage » ; apparaît aussi comme ligne optionnelle du devis.
8. **Notifications** : `project_events` alimente les envois WhatsApp au client (si numéro) et Telegram à l'équipe, plus une pastille « à traiter » dans l'onglet admin (questions ouvertes, validations reçues, documents déposés, mise à jour du jour manquante).

## Contraintes non négociables

1. **Twinsk seulement** : `/admin/projets` et `/projet/<jeton>` dans `TWINSK_ADMIN_PREFIXES` / `TWINSK_PUBLIC_PREFIXES` et le matcher du proxy ; les routes `/api/projects/*` refusent si `!COUNTRY.modules.twinsk`. Aucune valeur de pays en dur ailleurs ; devise du projet stockée et affichée par `formatInCurrency` / `formatSettlement`.
2. **Migration** : `supabase migration new projects`, testée en local (Postgres 14 jetable, rejouée deux fois), fusionnée dans `main` ; le workflow applique en CI puis au Gabon après approbation de Franck. Le code tourne sans erreur tant que la migration n'est pas appliquée (message « migration non appliquée »).
3. **Aucune écriture distante sans accord** (bucket, variables, cron Railway). Aucune écriture manuelle sur la base du Gabon.
4. **Logique pure testée** (Vitest, sans base ni réseau) : génération du plan et des échéances depuis un modèle, verrouillage des phases, règle « validation client seulement », progression, totaux du devis, transitions du stepper, projection publique (test de non-régression sur les champs interdits), alerte « journal manquant » avec jours ouvrés. `npm test`, `npm run lint`, `npx next build` puis `NEXT_PUBLIC_COUNTRY=CI npx next build` verts ; le nombre de tests ne baisse pas.
5. **Interface** : 100 % en français, libellés dans `src/lib/i18n/admin.ts` (fr et zh) pour la navigation ; composants sous `src/components/projects/` ; page admin `/admin/projets` (liste) et `/admin/projets/[id]` (onglets Plan, Journal, Questions, Documents, Devis, Commandes, Rapport) ; page client `/projet/[token]` avec les mêmes onglets en lecture-action limitée.
6. **Règles du dépôt** (`CLAUDE.md`) : `git add` explicite, commits séparés par étape, dossier du Bureau synchronisé après chaque push, aucun secret affiché ni commité, messages WhatsApp de test uniquement vers le numéro de Franck.

## Vérification réelle

1. Après déploiement et migration : créer le projet « PSG Academy DOM-TOM » depuis le modèle, générer un lien client, ouvrir `/projet/<jeton>` dans le navigateur intégré, vérifier qu'aucun nom de fournisseur ni prix d'achat n'apparaît (grep sur le HTML).
2. Depuis le lien client : cocher une sous-tâche, poser une question, valider une ligne de devis ; côté admin : répondre, passer la ligne en commande, avancer le stepper ; vérifier les entrées d'audit et de journal.
3. Envoyer une notification WhatsApp de test au numéro de Franck seulement.

## Livrables

- Code, migration et tests en commits séparés, dans l'ordre : modèle déclaratif et calculs purs → migration → routes admin et audit → routes client à jeton et projection publique → interface admin → interface client → devis et commandes → notifications et cron → PDF.
- `docs/projets/onglet-projet.md` : fonctionnement, comment créer un nouveau modèle de projet, comment donner et révoquer un accès client, ce que le client voit et ne voit pas.
- Mémoire du projet mise à jour et récapitulatif en français à Franck : ce qui a été vérifié en production, ce qui reste ouvert.

**Ne commence pas par l'interface.** À chaque étape, dis ce que tu as vérifié et comment.
