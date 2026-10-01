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
| **Usines** | (aperçu dans « Usines & échanges ») | Fiches **anonymisées** par lot : rang, note /25 et les 5 critères, statut (candidate, présélectionnée, **retenue**, écartée), description, expérience, capacité, délai, MOQ, caractéristiques du produit, certifications, échantillon |
| **Rapport & voyage** | Checklist du rapport final par phase, PDF, « remis » ; voit l'intérêt du client pour le voyage d'audit | Télécharge le rapport une fois remis ; « Je suis intéressé » / « Recevoir le devis du voyage » |
| **Usines & échanges** | Usines par lot, classées (retenue > présélectionnée > candidate > écartée, puis note /25) ; fiche en 3 volets : identité et **contacts** (e-mail, WeChat, WhatsApp, téléphone, canal conseillé, source ; bouton « Trouver les contacts (IA) »), fiche montrée au client, **notation** 5 critères /5 ; statut changé d'un clic (« Retenue » prévient le client, sous alias) ; **échanges** : captures d'écran WeChat/WhatsApp, e-mails, appels, relance prévue | **Jamais visible** (voir « Usines ») |
| **Messages usines** | Par lot, composés avec le plan : **e-mail RFQ (EN)**, **message court WeChat/WhatsApp (EN et 中文)**, modifiables ; signature de l'expéditeur ; choisir l'usine remplit [Factory]/[Contact] et propose `mailto:` ou `wa.me` avec le texte prérempli ; « Recomposer » depuis le modèle | **Jamais visible** |
| **Accès client** | Crée et révoque les liens, journal d'audit | — |

Chaque phase est verrouillée tant que la précédente n'est pas réceptionnée : ses tâches et lignes de devis sont visibles mais grisées.

## Sourcing des usines par un skill (30 septembre 2026)

« Usines & échanges » › **Besoin de sourcing (JSON)** exporte le besoin (`twinsk-sourcing-brief-v1`) ; le skill Cowork `sourcing-usines-chine` ([prompt](../prompts/skill-sourcing-usines.md)) rend 3 usines par élément, notées /25, avec fiche anonymisée et contacts (`twinsk-sourcing-v1`) ; **Importer (JSON)** › Vérifier › Importer. Import prudent : fiche client nettoyée de tout élément identifiant, « retenue » jamais automatique, usines existantes complétées sur leurs champs vides seulement. Code : `src/lib/projects/sourcing.ts`.

## Devises du devis (30 septembre 2026)

- Chaque prix (vente et achat) est **saisi dans sa devise** (yuan, dollar, euro, franc CFA…) : la ligne garde `price_currency` / `cost_currency`.
- Le projet a une **devise principale** (`projects.currency`, **dollar par défaut**, choisie à la création) et une table de taux `projects.rates` « 1 devise = X devise principale », modifiable dans Devis › « Devises et taux » (repères indicatifs proposés, à remplacer par le taux du jour ou négocié).
- Le client voit les prix dans la devise principale, avec le montant saisi entre parenthèses quand la devise diffère ; une ligne dont le taux manque reste « à chiffrer » (signalé aux deux côtés).
- **Validation** : le prix converti et le taux sont figés dans l'instantané (`validated_snapshot.entered`) ; les taux changés ensuite n'affectent que les brouillons.
- Changer la devise principale recalcule les taux (l'ancienne devise entre dans la table) ; refusé dès qu'une ligne est validée ou commandée.
- Logique pure et testée : `src/lib/projects/fx.ts` ; migration `20260930030000_project_currencies.sql`.

## Prix reçus des usines et comparaison (1er octobre 2026)

- **Fiche usine › Prix reçus** (équipe) : une offre = conditions (devise de l'usine, incoterm, port, délai, MOQ, validité, paiement, notes) + lignes : **produit** (avec variante « Hauteur=30 mm » et paliers « 2000:35; 5000:32.8 »), **option** (supplément) ou **frais** (montant fixe, ex. échantillons). Chaque produit est rattaché à une ligne du devis (automatique par unité et libellé, ou choisi). L'affichage s'adapte : colonnes de variantes, colonnes « dès N », prix usine et prix client côte à côte.
- **Depuis un message analysé** : quand l'analyse trouve des prix, « Vérifier et enregistrer l'offre de prix » ouvre l'offre déjà remplie (rattachée à l'échange).
- **Marge** : pourcentage par défaut du projet (`projects.default_margin_pct`, 25 %), remplaçable par offre en % ou en montant fixe par unité. Prix client = coût converti dans la devise du projet + marge, au palier correspondant à la quantité du devis.
- **Visibilité** : offre visible du client par défaut si l'usine est présélectionnée ou retenue ; œil pour masquer/montrer. Une nouvelle offre peut remplacer la précédente (gardée dans « Offres remplacées »).
- **Onglet Comparaison** (équipe et client) : une ligne par usine et par lot, une colonne par ligne du devis, total projet frais compris, meilleur prix en vert, filtre de variante. Le client voit les alias et les prix retravaillés et peut cliquer « Cette offre m'intéresse » (l'équipe est prévenue). « Devis » reporte le coût, le prix et l'usine sur la ligne du devis.
- Code : `src/lib/projects/offers.ts` (logique pure et testée), `Offers.tsx`, `Comparison.tsx` ; migration `20261001030000_project_offers.sql`. Champs interdits côté client : usine réelle, coût, devise d'achat, marge, conditions de paiement, texte brut.

## Rapport et voyages construits depuis les commandes (1er octobre 2026)

- L'onglet **Rapport & voyage** part **vierge** : plus d'itinéraire ni de liste de rapport tirés du modèle.
- **Rapport final** (par phase) : éléments saisis à la main ou « Ajouter depuis les commandes » (un élément par commande, rangé dans la phase de ses lignes, rattaché par `order_id`). Le client ne voit que les phases qui ont un élément ou un PDF.
- **Voyages d'audit** (`project_trips`) : « Planifier un voyage » › cocher les commandes › une étape par usine (ville de l'usine et programme pré-remplis, modifiables ; lot sans usine = étape « usine à préciser »), étapes libres possibles, note interne par voyage et par étape. Statuts : brouillon (invisible du client), proposé, confirmé, effectué ; le client est prévenu à chaque statut visible et peut cliquer « Je suis intéressé » / « Recevoir le devis du voyage ». Sans voyage proposé, il peut signaler un intérêt général.
- La ville d'une étape est visible du client : la vérifier avant de proposer le voyage.
- Code : `src/lib/projects/trips.ts` (logique testée), `ReportTrip.tsx` ; migration `20261001040000_project_trips.sql`.

## Confidentialité des fournisseurs

- Le client ne voit que les alias « Fournisseur A, B… », le classement et la fiche anonymisée (description, caractéristiques, certifications) rédigée par l'équipe : ne rien y écrire qui identifie l'usine (nom, ville, site).
- Noms réels, ville, site, contacts (e-mail, WeChat, WhatsApp), prix d'achat, prix indicatifs, notes internes, échanges usines et messages RFQ ne sortent que par les routes équipe (`/api/projects/<id>/…`).
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

## Assistants IA (30 septembre 2026, choix de Franck)

Trois aides, toutes **à relire avant validation** ; rien n'est créé ni publié sans un clic de l'équipe. Les appels passent par OpenRouter (`OPENROUTER_API_KEY`) et sont tracés dans le journal d'audit (`ai.used`, avec le coût).

| Aide | Où | Modèle | Coût mesuré |
|---|---|---|---|
| **Plan depuis un brief** : le texte libre du client devient un plan complet (phases, étapes, tâches datées, lignes de devis à chiffrer, lots) | « Nouveau projet » › « Depuis un brief (IA) » › « Générer le plan », puis « Créer ce projet » | Kimi K2 (`moonshotai/kimi-k2-0905`, variable `PROJECT_PLAN_MODEL`) | ≈ 6,5 FCFA par plan |
| **Résumé d'un échange usine** : lit les captures d'écran (WeChat, WhatsApp, e-mail, chinois ou anglais compris) et propose le résumé en français, les chiffres cités, le canal et la relance à prévoir | Usines & échanges › Nouvel échange › joindre des captures › « Résumer avec l'IA » | GLM 5.3 Flash (`z-ai/glm-5.3-flash`, variable `PROJECT_FLASH_MODEL`) | ≈ 0,1 FCFA par capture |
| **Brouillon du journal** : rédige la mise à jour du jour à partir de ce qui a bougé depuis la dernière (tâches, échéances proches, commandes, questions, documents, échanges usines reformulés sans nom d'usine) | Journal › « Préparer avec l'IA » | GLM 5.3 Flash | ≈ 0,2 FCFA |
| **Contacts d'une usine** : cherche sur le web (site officiel, Alibaba, Made-in-China) l'e-mail, le WeChat, le WhatsApp du commercial export et le canal conseillé ; ne remplit que les champs vides, avec la source et un niveau de confiance | Usines & échanges › fiche › « Trouver les contacts (IA) » | GLM 5.3 Flash **avec recherche web** (suffixe OpenRouter `:online`, variable `PROJECT_CONTACT_MODEL`) | jetons + recherche web OpenRouter (≈ 10–15 FCFA par usine) |

Le plan depuis un brief produit aussi la **matière des messages RFQ** (`rfq_context` : le programme en une phrase EN/ZH et les exigences communes ; `rfq` : par lot, produit EN/ZH, quantités, exigences). Les messages eux-mêmes sont composés par `src/lib/projects/rfq.ts` (déterministe, testé) — pas par le modèle — à la création du projet, depuis le modèle déclaratif (`rfq_context`/`rfq` de `dom-tom.ts`) ou depuis les lignes de devis à défaut.

Le compte Moonshot direct (`KIMI_API_KEY`) n'est pas utilisé ici : Kimi est appelé via OpenRouter. Kimi K2.6 a été écarté : il consomme tout le budget de réponse à réfléchir.

## Créer un nouveau modèle de projet

1. Copier `src/lib/projects/templates/dom-tom.ts` : phases, durées de référence, étapes et tâches (responsable, échéance en semaines, checklist), lignes de devis (lot, unité, quantité, option, phase), lots, programme de voyage, checklist du rapport.
2. L'ajouter à `PROJECT_TEMPLATES`. Il apparaît dans « Nouveau projet ».
3. Les échéances absolues sont calculées depuis la date de lancement ; les tâches et lignes restent modifiables ensuite.

## Fichiers du module

| Rôle | Fichier |
|---|---|
| Types, listes fermées | `src/lib/projects/types.ts` |
| Modèle DOM-TOM | `src/lib/projects/templates/dom-tom.ts` |
| Logique pure (plan, phases, devis, stepper, jours ouvrés, notation et classement des usines) | `src/lib/projects/logic.ts` |
| Messages RFQ (EN + ZH), crochets, liens `mailto:` / `wa.me` | `src/lib/projects/rfq.ts` |
| Devises et taux (conversion, changement de base) | `src/lib/projects/fx.ts` |
| Projection publique et vue équipe | `src/lib/projects/public.ts`, `public-server.ts` |
| Couche serveur et audit | `src/lib/projects/data.ts` |
| Authentification équipe / client | `src/lib/projects/auth.ts` |
| Notifications | `src/lib/projects/notify.ts` |
| PDF | `src/lib/projects/pdf.ts`, `src/components/projects/ProjectQuotePDF.tsx` |
| Routes équipe | `src/app/api/projects/…` |
| Routes client | `src/app/api/projects/public/[token]/…` |
| Pages | `/admin/projets`, `/admin/projets/[id]`, `/projet/[token]` |
| Migration | `supabase/migrations/20260930000000_projects.sql` (16 tables, RLS) ; `20260930010000_project_suppliers_scoring.sql` (notation, statut, fiche client, contacts, `projects.rfq_sender`, table `project_rfq_messages`) |

## Vérifications faites le 30 septembre 2026

- 473 tests (19 nouveaux : plan, échéances, phases, rôles, devis, stepper, jours ouvrés, projection publique, notifications, rendu PDF).
- Migration rejouée deux fois sur un Postgres local.
- Builds Gabon et Côte d'Ivoire.

Restant : création du bucket et du cron par Franck, migration du Gabon à approuver, premier projet à créer depuis l'interface puis lien client à tester.
