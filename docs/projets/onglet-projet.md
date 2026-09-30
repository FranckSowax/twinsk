# Onglet « Projets » — suivi client d'un programme d'équipement

Mis en place le 30 septembre 2026 (prompt : [docs/prompts/onglet-projet.md](../prompts/onglet-projet.md)). **Partie Twinsk seulement** : visible au Gabon, absent d'Oh My 225 !.

## Ce que ça fait

Un projet = un programme clé en main (le premier : PSG Academy DOM-TOM) suivi avec le client dans un espace partagé :

| Onglet | Équipe | Client |
|---|---|---|
| **Plan d'action** | 8 étapes générées depuis le modèle, tâches avec échéances calculées, checklists, pièces jointes, commentaires ; ajout de tâches ; réception des phases | Coche ses tâches (validation client), ses sous-points, commente, joint des fichiers |
| **Journal** | Publie la mise à jour du jour (rappel Telegram si rien la veille ouvrée) | Lit et réagit |
| **Questions** | Répond (le ticket passe « Répondu ») | Pose des questions avec pièce jointe ; délai affiché « 24 h ouvrées » |
| **Documents** | Dépose, supprime, peut marquer « réservé à l'équipe » | Dépose et télécharge les documents partagés |
| **Devis** | Lignes par lot, prix de vente, prix d'achat (masqué), fournisseur pressenti, options ; passe les lignes validées en commande ; PDF | Ajuste les quantités, active les options, **valide ligne par ligne**, annule tant que non commandé ; PDF |
| **Commandes** | Avance le stepper (validée → émise → acompte → production → inspection → expédiée → transit → livrée), suivi | Suit chaque commande ; chaque étape crée une entrée de journal |
| **Rapport & voyage** | Checklist du rapport final par phase, PDF, « remis » ; voit l'intérêt du client pour le voyage d'audit | Télécharge le rapport une fois remis ; « Je suis intéressé » / « Recevoir le devis du voyage » |
| **Usines & échanges** | Fournisseurs par lot (alias automatique A, B, C…, identité réelle, contact, score /25) ; **échanges** : captures d'écran WeChat/WhatsApp, e-mails, appels, relance prévue | **Jamais visible** |
| **Accès client** | Crée et révoque les liens, journal d'audit | — |

Chaque phase est verrouillée tant que la précédente n'est pas réceptionnée : ses tâches et lignes de devis sont visibles mais grisées.

## Confidentialité des fournisseurs

- Le client ne voit que les alias « Fournisseur A, B… ».
- Noms réels, contacts, prix d'achat, notes internes et échanges usines ne sortent que par les routes équipe (`/api/projects/<id>/…`).
- La projection publique (`src/lib/projects/public.ts`) est construite **champ par champ** ; `logic.test.ts` échoue si un champ interdit (`real_name`, `contact`, `unit_cost`, `exchanges`, `token`…) apparaît dans la sortie, même quand la base en contient.
- Le PDF du devis est généré depuis cette même projection, côté équipe comme côté client.

## Accès client

- Lien par personne, créé dans « Accès client » : `/projet/<jeton>` (jeton aléatoire de 43 caractères, expiration facultative, révocation, compteur de vues).
- Pas de compte ni de mot de passe. Pour retirer l'accès : « Révoquer ».
- Le client agit toujours en son nom (le nom du lien) : validations et commentaires sont tracés dans le journal d'audit.

## Fichiers

- Bucket **privé** `project-files` (Supabase), liens signés de 15 minutes. Types : images, PDF, Word, Excel, texte, e-mail `.eml` ; 25 Mo maximum.
- Toute pièce jointe (tâche, commentaire, journal, question, échange usine, rapport) est un document du projet. Un document marqué « réservé à l'équipe » n'apparaît jamais côté client, même en pièce jointe.
- **À créer une fois par pays** (écriture distante, lancée par Franck) : `npx tsx scripts/supabase/recreate-buckets.ts --apply` après `supabase link`. Sans le bucket, les envois répondent « Bucket project-files absent ».

## Notifications

- **Client** : WhatsApp (numéro du projet) via `sendWhapiText`, message groupé par projet avec le lien de son espace : mises à jour, réponses, nouvelles lignes, commandes, jalons, rapport. Rien sans numéro.
- **Équipe** : Telegram (`sendTelegramMessage`) : questions, validations, commentaires, dépôts de documents, intérêt pour le voyage, **journal manquant**. Muet tant que `TELEGRAM_BOT_TOKEN` n'est pas défini sur Railway (la variable actuelle s'appelle `TELEGRAM_TOKEN`).
- Envoi par le cron `GET /api/cron/projects?key=$CRON_SECRET` (toutes les 15 min ; rappel journal entre 9 h et 11 h, jours ouvrés). Service Railway à créer sur le modèle de `cron-cash` : image `curlimages/curl`, `sh -c 'curl -fsS -H "x-cron-key: $CRON_SECRET" "https://twinsk-production.up.railway.app/api/cron/projects"'`, `*/15 * * * *`.
- Pastille dans la liste des projets : « nouveautés client » = événements équipe non encore vus.

## Créer un nouveau modèle de projet

1. Copier `src/lib/projects/templates/dom-tom.ts` : phases, durées de référence, étapes et tâches (responsable, échéance en semaines, checklist), lignes de devis (lot, unité, quantité, option, phase), lots, programme de voyage, checklist du rapport.
2. L'ajouter à `PROJECT_TEMPLATES`. Il apparaît dans « Nouveau projet ».
3. Les échéances absolues sont calculées depuis la date de lancement ; les tâches et lignes restent modifiables ensuite.

## Fichiers du module

| Rôle | Fichier |
|---|---|
| Types, listes fermées | `src/lib/projects/types.ts` |
| Modèle DOM-TOM | `src/lib/projects/templates/dom-tom.ts` |
| Logique pure (plan, phases, devis, stepper, jours ouvrés) | `src/lib/projects/logic.ts` |
| Projection publique et vue équipe | `src/lib/projects/public.ts`, `public-server.ts` |
| Couche serveur et audit | `src/lib/projects/data.ts` |
| Authentification équipe / client | `src/lib/projects/auth.ts` |
| Notifications | `src/lib/projects/notify.ts` |
| PDF | `src/lib/projects/pdf.ts`, `src/components/projects/ProjectQuotePDF.tsx` |
| Routes équipe | `src/app/api/projects/…` |
| Routes client | `src/app/api/projects/public/[token]/…` |
| Pages | `/admin/projets`, `/admin/projets/[id]`, `/projet/[token]` |
| Migration | `supabase/migrations/20260930000000_projects.sql` (16 tables, RLS) |

## Vérifications faites le 30 septembre 2026

- 473 tests (19 nouveaux : plan, échéances, phases, rôles, devis, stepper, jours ouvrés, projection publique, notifications, rendu PDF).
- Migration rejouée deux fois sur un Postgres local.
- Builds Gabon et Côte d'Ivoire.

Restant : création du bucket et du cron par Franck, migration du Gabon à approuver, premier projet à créer depuis l'interface puis lien client à tester.
