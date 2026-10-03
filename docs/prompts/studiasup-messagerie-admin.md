# Prompt Claude Code — StudiaSup : refonte de l'onglet « Messagerie » de l'admin

> À coller tel quel dans une session Claude Code ouverte **à la racine du dépôt StudiaSup**.
> Inspiré de la messagerie WhatsApp déjà en production sur Oh My Gab (Twinsk) : mêmes principes, adaptés à StudiaSup.

---

## Rôle et objectif

Tu es le développeur principal de **StudiaSup**. Tu vas **refaire entièrement l'onglet « Messagerie » de l'admin** pour qu'une petite équipe de collaborateurs gère ensemble les conversations WhatsApp des prospects et des étudiants :

1. **Gestion des conversations par collaborateur** : chaque conversation a un responsable. On voit ce qui attend une réponse, qui suit qui, et on peut s'attribuer, transférer ou terminer une conversation.
2. **Phrases rapides** : réponses toutes faites, avec variables, insérables en un clic.
3. **Médias** : envoi d'images, de vidéos et de documents (brochures, fiches formation, listes de pièces) depuis une médiathèque ou par téléversement.
4. **Lien vers la page d'inscription** : insérable en un clic dans une réponse. Le lien permet de savoir quel collaborateur a amené l'inscription.

Tu réponds et tu écris toute l'interface **en français**.

## Règles non négociables

- **Aucune écriture sur un système distant sans mon accord explicite.** Cela couvre la base de production, les variables d'environnement, le webhook du fournisseur WhatsApp et les déploiements. Avant chaque action de ce type, tu t'arrêtes et tu me demandes.
- **Le schéma ne change que par migration** : un fichier versionné dans le dépôt, testé en local. Jamais par le tableau de bord de la base. Toute nouvelle table active la RLS.
- **Le navigateur ne lit jamais la base directement.** Tout passe par des routes serveur, avec une clé serveur.
- **Aucun secret dans le code ni dans un commit.** Ne jamais afficher une clé dans le terminal.
- **Messages de test WhatsApp : uniquement vers mon numéro**, que je te donnerai. Jamais vers un prospect réel.
- **Ne jamais modifier le fil WhatsApp lui-même.** Les tables de suivi s'ajoutent à côté, elles ne remplacent rien.
- **Pas de données personnelles dans les URL** : ni téléphone, ni nom, ni e-mail en paramètre de requête. Utiliser un jeton opaque à la place.
- **Ne pas inventer** d'endpoint, de paramètre d'API ou de nom de table. Ce que tu ne trouves pas dans le code ou la documentation officielle, tu me le demandes.
- Commits avec `git add` explicite (fichier par fichier), petits et ciblés. Pas de push sans mon accord.

---

## Phase 0 — Audit en lecture seule (aucune modification)

Lis le dépôt et rends-moi un rapport court qui répond à ces questions :

1. **Pile technique** : framework, base de données, authentification, hébergement, tests, lint, build.
2. **Onglet Messagerie actuel** : fichiers, routes, tables, ce qui marche, ce qui ne marche pas, ce qu'on peut garder.
3. **Fournisseur WhatsApp** : WHAPI, API officielle WhatsApp Cloud (Meta), autre ? Réponds avec précision :
   - où sont le jeton et l'URL de base ;
   - le webhook existe-t-il, et à quels événements est-il abonné (messages, statuts) ?
   - si c'est l'API officielle Meta, comment gère-t-on la fenêtre de 24 h et les modèles approuvés ?
4. **Collaborateurs** : où sont-ils définis (table, rôles, connexion) ? Quels rôles existent ? Qui est admin ?
5. **Page d'inscription** : sa route publique exacte, les champs du formulaire, la table où arrivent les inscriptions, et s'il existe déjà un suivi de provenance (`ref`, UTM).
6. **Médias** : stockage existant (bucket, CDN), limites de taille, médiathèque déjà présente ou non.
7. **Données** : volumes approximatifs (conversations, messages) et ancienneté de l'historique récupérable chez le fournisseur.

Termine par **une liste de questions** sur ce que tu ne peux pas trancher seul, puis **attends ma validation**. Pose au minimum ces trois-là :
- un collaborateur voit-il toutes les conversations ou seulement les siennes et celles non attribuées ?
- faut-il une répartition automatique des nouvelles conversations ?
- les phrases rapides sont-elles communes à l'équipe ou propres à chaque collaborateur ?

---

## Phase 1 — Données et ingestion

**Tables de suivi** (noms à adapter à l'existant) :

**`wa_conversations`** : une ligne par contact privé.
- Identité : `chat_id`, `phone`, `display_name`, `student_id` éventuel (lien vers l'étudiant ou le prospect s'il est connu).
- Suivi : `status` (`open` | `replied` | `closed`), `assigned_to`, `assigned_at`, `unread_count`, `note`.
- Derniers échanges : `last_message_at`, `last_inbound_at`, `last_outbound_at`, `last_message_preview`, `last_outbound_status`.
- Origine : `source` en jsonb (publicité Click-to-WhatsApp, lien, direct).

**`wa_messages`** :
- Identité : `id` = l'identifiant du fournisseur (clé d'idempotence), `conversation_id`, `from_me`, `type`.
- Contenu : `body`, `media_url`, `mime`, `filename`, `caption`.
- Auteur : `sent_by`, avec ces valeurs possibles :
  - id du collaborateur ;
  - `'admin'` ;
  - `null` quand le message a été envoyé depuis le téléphone.
- Accusé : `status` (`sent` | `delivered` | `read`), `status_at`.
- Contexte et date : `context` en jsonb (message cité, origine publicitaire, boutons), `sent_at`.

**Paramètres** : phrases rapides, médiathèque et épingles, chacun dans sa table ou dans une table de réglages existante.

**Ingestion par le webhook**
- La branche « conversation privée » ne doit **jamais bloquer** le reste du webhook : en cas d'erreur, `try/catch` et on journalise.
- Idempotence : `upsert` sur l'id du message avec `ignoreDuplicates`. Un message envoyé depuis l'interface puis renvoyé par le webhook ne doit pas apparaître deux fois, ni perdre son auteur.
- Types à gérer :
  - texte, image, vidéo, document, audio et note vocale, sticker, localisation, contact ;
  - réponse citée (garder `quoted_id`, `quoted_content`) ;
  - **message contenant un lien** : chez WHAPI c'est `type: link_preview`, avec le texte complet dans `link_preview.body`. Il ne faut pas le perdre.
  - Tout type inconnu est journalisé (`[inbox] type ignoré « … »`), jamais silencieusement jeté.
- Mise à jour de la conversation :
  - **message du client** : `unread_count + 1`, statut repassé à `open`, même si la conversation était terminée ;
  - **sauf message de pure politesse** (« merci », « ok merci », 👍), qui ne rouvre pas une conversation répondue ou terminée. « ok » ou « oui » seuls, ou une question, la rouvrent ;
  - **notre réponse** : `unread_count = 0`, statut `replied`.
- **Accusés** (événement de statut) : on fusionne sans jamais reculer (`read` ne redevient pas `delivered`).
- **Récupération d'historique** : une route qui relit les ~100 derniers messages d'une conversation chez le fournisseur et les importe sans écraser les auteurs. Elle se lance à la première ouverture d'une conversation dans la session, et par un bouton « Historique ».

**Logique pure** dans un module séparé, couvert par des tests unitaires : description d'un message, calcul du patch de conversation, détection des messages de politesse, fusion des accusés, extraction du contexte.

**Numéros** : normaliser au format international. Avant tout envoi, préférer le numéro d'une conversation où le client a **déjà écrit** : des formats différents peuvent cacher le même contact.

---

## Phase 2 — Liste et fil de conversation (lecture)

**Mise en page** : deux colonnes sur ordinateur, liste puis fil sur mobile (mobile d'abord, la plupart des collaborateurs travaillent au téléphone).

**Liste des conversations**
- **Onglets** :
  - « À répondre » (dernier message du client sans réponse) ;
  - « Mes conversations » ;
  - « Non attribuées » ;
  - « Toutes » ;
  - « Terminées » ;
  - « Épinglées ».
- **Recherche** : nom, numéro, contenu.
- **Chaque ligne** :
  - avatar et initiales, nom ou numéro ;
  - aperçu du dernier message, heure, pastille de non-lus ;
  - **temps d'attente** depuis le dernier message client (couleur selon l'ancienneté) ;
  - responsable (initiales), badge d'origine (pub, lien d'inscription).
- **Action rapide** sur la ligne : « Terminer ».

**Fil de conversation**
- Bulles client et équipe, avec l'**auteur sous chaque message envoyé** (nom du collaborateur, ou « 📱 téléphone »).
- Coches d'accusé.
- Réponses citées.
- **Médias** : aperçu d'image et de vidéo, carte de document.
- **Carte d'aperçu de lien** : titre, description et image Open Graph, lues **côté serveur** :
  - protection SSRF : http(s) uniquement, IP privées refusées à chaque redirection, 4 redirections max ;
  - délai 6 s, 600 Ko max ;
  - cache.
- **Panneau latéral** :
  - fiche du contact (inscrit ou non, formation visée si connue) ;
  - note interne ;
  - historique d'attribution ;
  - origine (publicité : titre, visuel).

**Rafraîchissement** : temps réel si la pile le permet proprement, sinon interrogation régulière (liste toutes les 10 s, fil toutes les 6 s), en pause quand l'onglet est caché.

---

## Phase 3 — Envoi : texte, phrases rapides, médias, lien d'inscription

**Zone de saisie** : texte multiligne, sélecteur d'emoji (teinte de peau mémorisée par collaborateur), envoi avec Entrée, et Maj+Entrée pour aller à la ligne.

**Phrases rapides**
- Accès par un bouton, et par `/` en début de saisie avec recherche instantanée.
- Variables :
  - `{prenom}`, `{nom}`, `{numero}` ;
  - `{collaborateur}` (prénom de celui qui répond) ;
  - `{lien_inscription}`.
- Aperçu « comme le client le verra » avant l'envoi.
- Éditeur : créer, modifier, classer par catégories (Accueil, Formations, Pièces à fournir, Paiement, Relance…), réordonner. Qui peut éditer ? → selon ma réponse à la Phase 0 (par défaut : l'admin).

**Médias**
- Médiathèque partagée : téléverser, nommer, catégoriser, rechercher.
- Envoi d'image, de vidéo ou de document avec légende facultative.
- Limites de taille du fournisseur vérifiées **avant** l'envoi, avec un message clair si le fichier est trop lourd.

**Lien vers la page d'inscription**
- Bouton « Lien d'inscription » qui insère l'URL publique de la page d'inscription. L'origine vient de la configuration, jamais écrite en dur.
- **Attribution** : le lien porte un **jeton opaque** (par exemple `?r=<jeton>`) qui renvoie côté serveur à la conversation et au collaborateur. Jamais de téléphone, de nom ou d'e-mail en clair dans l'URL.
- Quand quelqu'un s'inscrit avec ce jeton :
  - l'inscription est rattachée à la conversation et au collaborateur ;
  - un badge « Inscrit » apparaît dans la liste et sur la fiche.
- Le collaborateur peut aussi insérer les autres liens publics utiles (page d'une formation, brochure), choisis dans une liste.

**Route d'envoi**
- `POST /…/conversations/<id>/reply` avec `{ type: 'text' | 'image' | 'video' | 'document', … }`.
- Le message est inscrit dans le fil avec `sent_by` et le statut `sent`.
- **Répondre attribue automatiquement** la conversation si personne ne la suivait.

**Envois automatiques** de la plateforme vers le client (confirmations, relances) : décide avec moi lesquels doivent apparaître dans le fil. Par défaut, seuls les envois déclenchés par un collaborateur y figurent.

**Si l'API officielle Meta est utilisée** : hors de la fenêtre de 24 h, la saisie libre est bloquée et on propose les modèles approuvés.

---

## Phase 4 — Travail en équipe

- **Attribution** :
  - « M'attribuer », « Attribuer à… » (liste des collaborateurs actifs), « Libérer » ;
  - transfert avec note facultative ;
  - historique horodaté.
- **Statuts** : `open`, `replied`, « Terminer » (`closed`). Un nouveau message client rouvre la conversation, sauf message de politesse.
- **Épingles par personne**.
- **Visibilité** selon ma réponse à la Phase 0. L'admin voit tout dans tous les cas.
- **Répartition automatique** des nouvelles conversations : seulement si je la demande (par exemple au tour par tour entre collaborateurs disponibles).
- **Mini-tableau en tête de page** :
  - conversations à répondre ;
  - délai médian de première réponse aujourd'hui ;
  - conversations par collaborateur ;
  - inscriptions venues de la messagerie cette semaine.
- **Droits vérifiés côté serveur** sur chaque route (lecture, envoi, attribution, édition des phrases rapides et de la médiathèque). L'interface ne fait que refléter ces droits.

---

## Phase 5 — Finition et vérification

- Tests unitaires sur toute la logique pure (Phase 1), sur le jeton d'inscription et sur les droits.
- Lint et build sans erreur.
- **Parcours vérifié dans le vrai navigateur** en local :
  - réception simulée d'un message par une charge utile de webhook enregistrée ;
  - réponse texte, phrase rapide avec variables, média, lien d'inscription ;
  - attribution, « Terminer », réouverture par un message client ;
  - inscription via le lien et badge « Inscrit ».
- Mobile vérifié à 390 px de large.
- Un **guide d'utilisation court** pour les collaborateurs (`docs/messagerie.md`) : les onglets, comment s'attribuer une conversation, les phrases rapides, le lien d'inscription.

---

## Méthode de travail

- **Une phase = un point d'arrêt.** À la fin de chaque phase :
  - ce qui a été fait, avec les fichiers et les commits ;
  - le résultat des tests, du lint et du build ;
  - ce qu'il me reste à faire de mon côté (migration à appliquer, webhook à réabonner, variable à poser) ;
  - puis **attendre mon feu vert** avant la phase suivante.
- Les migrations sont écrites et testées en local. **C'est moi qui les applique en production**, ou toi après mon accord explicite.
- Si le webhook doit être réabonné (par exemple ajouter les statuts pour les coches), tu me le dis et tu attends.
- Si une demande de ce prompt entre en conflit avec ce que tu découvres dans le code, signale-le au lieu de forcer.

## Critères d'acceptation

1. Un message WhatsApp entrant apparaît dans « À répondre » en moins de 15 s, avec le bon type de contenu (texte, lien, média).
2. Deux collaborateurs peuvent travailler en même temps. Chacun voit qui suit quelle conversation, et l'auteur de chaque réponse est affiché.
3. Une phrase rapide avec `{prenom}` et `{lien_inscription}` part correctement remplie.
4. Une image, une vidéo et un PDF partent depuis la médiathèque.
5. Une inscription faite via le lien envoyé est rattachée au bon collaborateur. Aucune donnée personnelle n'apparaît dans l'URL.
6. Aucune régression sur le reste du webhook ni sur le reste de l'admin. Tests, lint et build sont verts.
