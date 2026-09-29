# Analyse IA des conversations WhatsApp

Mise en place le 29 septembre 2026. Décisions de Franck : fournisseur **OpenRouter** avec le modèle **GLM 5.3 Flash** de Z.ai (`z-ai/glm-5.3-flash`) pour le Gabon et la Côte d'Ivoire, numéros masqués, analyse horaire, rapport à 21 h. Prompt d'origine : [docs/prompts/analyse-conversations.md](../prompts/analyse-conversations.md).

## Ce que ça fait

Chaque conversation privée reçue sur le numéro WhatsApp du pays est lue par un modèle de langage, qui en tire une fiche :
- **besoin du client**, intention (question prix, transport, projet clé en main, produit hors catalogue…) ;
- **stade d'achat** et **intention d'achat** (0 à 100) ;
- produits demandés, objections, transport et paiement évoqués, zone de livraison ;
- **risque d'abandon** ;
- **prochaine action**, reliée à un outil de la messagerie ;
- **questions mal traitées** par l'équipe, avec une réponse type proposée.

Le stade d'achat proposé par le modèle est **corrigé par les faits** : une commande du même numéro (payée, paiement engagé, panier) fixe un stade minimal. Les deux avis sont conservés (`llmStage` et `factStage`).

Chaque soir à 21 h (heure du pays), un **rapport** agrège les analyses du jour :
- stades et intentions ;
- produits demandés et produits hors catalogue ;
- objections par listing et par pub ;
- zones de livraison ;
- questions mal traitées ;
- relances à faire ;
- chiffre d'affaires en suspens.

Le modèle rédige ensuite constats et recommandations **à partir de ces seules statistiques**, jamais des dialogues.

## Où le voir

- **Messagerie** (`/admin/inbox` et `/agent`) :
  - volet « Analyse IA » en tête du fil, avec le bouton de la prochaine action et « Ré-analyser » ;
  - badges « stade », « intention » et « risque » dans la liste ;
  - filtre **🔥 Chauds** : prêts à acheter ou intention ≥ 70, triés par intention.
- **Tableau de bord** (`/admin`) : section « Analyse des conversations (IA) », qui suit le sélecteur 7 j / 30 j / 90 j / tout, avec le rapport du jour et un bouton « Générer maintenant ».

Chaque prochaine action ouvre un outil qui existe déjà :

| Action | Effet |
|---|---|
| Créer le panier | Ouvre le panier client pré-rempli |
| Envoyer une sélection | Ouvre la sélection client pré-remplie |
| Envoyer le listing | Insère le lien du listing d'origine (sinon /bio) dans la réponse |
| Relancer sous 24 h | Épingle la conversation et ajoute une note interne |
| Passer à l'admin, recherche produit | Note interne |
| Autres | Insère la phrase suggérée dans la réponse, à relire avant envoi |

## Fonctionnement technique

| Élément | Fichier |
|---|---|
| Taxonomie : valeurs, libellés, défauts, prompt | `src/lib/conversation-analysis/taxonomy.ts` |
| Validation stricte, correction du stade par les faits, coût | `src/lib/conversation-analysis/analysis.ts` |
| Dialogue : masquage, lignes, troncature (1er + 29 derniers), seuils | `src/lib/conversation-analysis/dialogue.ts` |
| Agrégations du rapport, entrée du prompt du rapport | `src/lib/conversation-analysis/report.ts` |
| Service serveur : analyse, lot horaire, rapport, lectures | `src/lib/conversation-analysis/service.ts` |
| Couche IA commune (OpenRouter par défaut ; Kimi ou Anthropic en option) | `src/lib/llm.ts` |
| Tables | `supabase/migrations/20260929010000_conversation_analysis.sql` |
| Cron horaire (+ rapport à partir de 21 h) | `GET /api/cron/conversation-analysis?key=$CRON_SECRET` |
| Rapport à la demande (cron ou admin) | `GET/POST /api/cron/conversation-report` |
| Ré-analyse, dernière analyse | `POST/GET /api/inbox/conversations/<id>/analyze` |
| Synthèse du tableau de bord | `GET /api/admin/stats/conversation-analysis?period=` |
| Test à blanc (n'écrit rien) | `npx tsx scripts/analysis-dry-run.ts <id> … [--dialogue]` |

**Quand une conversation est analysée** :
- au moins **2 messages du client** ;
- rien reçu ni envoyé depuis **30 min** ;
- **du nouveau** depuis la dernière analyse (`wa_conversations.analyzed_message_id`) ;
- lot de **40** par passage (`ANALYSIS_BATCH_LIMIT`) ;
- **plafond de 500 FCFA par jour** (`ANALYSIS_DAILY_BUDGET_FCFA`).

La ré-analyse manuelle ignore le calme et la nouveauté, mais garde le minimum de 2 messages client.

**Ce qui part chez le fournisseur** :
- les 30 messages utiles de la conversation (le premier et les 29 derniers) ;
- le titre de la pub et du listing d'origine.

Numéros de téléphone et e-mails sont remplacés par `[numéro]` et `[e-mail]`. Le nom du client n'est pas envoyé. Les montants restent lisibles.

**Variables d'environnement** (service Railway du pays) :

| Variable | Défaut | Rôle |
|---|---|---|
| `OPENROUTER_API_KEY` | à renseigner par Franck, sur `twinsk` et `ohmycot` | Clé OpenRouter |
| `ANALYSIS_LLM_PROVIDER` | `openrouter` | `kimi` (avec `KIMI_API_KEY`) ou `anthropic` (avec `ANTHROPIC_API_KEY`) |
| `ANALYSIS_MODEL` | `z-ai/glm-5.3-flash` | Identifiant du modèle chez le fournisseur |
| `ANALYSIS_BATCH_LIMIT` | 40 | Conversations par passage |
| `ANALYSIS_DAILY_BUDGET_FCFA` | 500 | Plafond de dépense par jour |
| `ANALYSIS_PRICE_IN_PER_M`, `ANALYSIS_PRICE_OUT_PER_M`, `USD_TO_FCFA` | 0,15, 0,50, 600 | OpenRouter renvoie le **coût réel** de chaque appel ; ces tarifs ne servent qu'en repli, et `USD_TO_FCFA` pour la conversion |

## Ajouter ou modifier une catégorie

1. Ajouter la valeur et son libellé dans la liste concernée de `taxonomy.ts` (`INTENTS`, `OBJECTIONS`, `NEXT_ACTIONS`…). Le prompt et la validation la prennent automatiquement.
2. Pour une nouvelle **prochaine action**, lui donner un effet dans `runAction` (`src/components/inbox/AnalysisPanel.tsx`). Sans effet dédié, elle insère la phrase suggérée.
3. Ajouter un cas au test `src/lib/conversation-analysis/analysis.test.ts`.

Aucune migration n'est nécessaire : les détails sont stockés en `jsonb` (`commerce`).

## Coût

Mesure prévue sur trois conversations réelles du Gabon (test à blanc). **Non mesurée au 29 septembre** : en attente de la clé OpenRouter (le premier essai, sur Kimi, a échoué car le compte Moonshot est sans solde). À compléter avec :

```bash
npx tsx scripts/analysis-dry-run.ts ad1ff7b3-4d13-4018-b7d5-ec94b45f0b5f bc62c31c-4fe4-449c-9d73-488285385f50 31e7c5f1-e123-4382-bfb7-c4e9e42c6b1c
```

Ordre de grandeur attendu :
- environ 2 000 tokens en entrée et 400 en sortie par conversation ; au tarif de GLM 5.3 Flash (0,15 $ / 0,50 $ par million), soit **environ 0,3 FCFA par analyse** ;
- environ 300 analyses par mois au rythme de septembre, soit **environ 100 FCFA par mois** au Gabon, rapports compris.

## Services cron Railway

Modèle `cron-cash` : image `curlimages/curl`, `APP_URL` et `CRON_SECRET` par référence au service du site.

| Service | Planification (UTC) | Commande |
|---|---|---|
| `cron-conversation-analysis` (Gabon) | `5 * * * *` | `sh -c 'curl -fsS "$APP_URL/api/cron/conversation-analysis?key=$CRON_SECRET"'`, `APP_URL=https://${{twinsk.RAILWAY_PUBLIC_DOMAIN}}`, `CRON_SECRET=${{twinsk.CRON_SECRET}}` |
| `ohmycot-cron-conversation-analysis` (Côte d'Ivoire) | `5 * * * *` | idem avec `${{ohmycot.…}}` |
