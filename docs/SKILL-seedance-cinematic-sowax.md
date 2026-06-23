---
name: seedance-cinematic-sowax
description: Pipeline complet pour générer des clips vidéo cinématiques avec Seedance 2.0 via le MCP Higgsfield, et pour appliquer la méthodologie de monétisation faceless (YouTube/TikTok/Instagram). Utilise CE skill dès que l'utilisateur parle de générer une vidéo, un clip, un teaser, une pub vidéo, un hero video, un prompt Seedance/Higgsfield/Kling, ou demande du contenu vidéo pour une marque Sowax (OhMyGab, DriveBy, Studia, KardAfrica, Notarius, Kartelle, Twinsk, Gabon Insight) — même sans dire explicitement "Seedance". Couvre la rédaction de prompts cinématiques structurés, la séquence d'appels MCP Higgsfield (models_explore → upload → generate_video → job_display), l'optimisation des coûts crédits, et la production de contenu monétisable.
---

# Seedance 2.0 — Pipeline cinématique Sowax (via MCP Higgsfield)

Skill pour produire des clips vidéo cinématiques de qualité marque avec **Seedance 2.0** (modèle ByteDance), piloté par le **MCP Higgsfield**, en respectant les invariants marché Sowax (FCFA, Mobile Money, WhatsApp-first, contexte Gabon/CEMAC). Couvre aussi la méthodologie de monétisation faceless si l'objectif est une chaîne de contenu.

## Deux usages, un même moteur

1. **Marketing de marque** (usage principal Franck) → hero videos, teasers, pubs pour les ventures Sowax. Aller direct aux presets : `references/presets-ventures.md`.
2. **Chaîne faceless monétisable** (YouTube Shorts / TikTok / Reels) → méthodo niche → script → clips → montage → upload. Voir `references/prompts-reutilisables.md`.

---

## Le workflow MCP Higgsfield (séquence exacte)

Toujours suivre cet ordre. Ne jamais deviner les paramètres : Higgsfield expose des specs qui évoluent.

1. **Vérifier le solde** (optionnel) → outil `Higgsfield:balance`.
2. **Découvrir le modèle et ses paramètres réels** → `Higgsfield:models_explore` avec `type:'video'`. Récupérer le nom machine (`seedance_2_0`), les `aspect_ratios` supportés, les `durations`, et les rôles `medias` autorisés (`start_image`, `end_image`, `image`, `audio`). **Cette étape est obligatoire avant toute génération** — les durées et résolutions disponibles dépendent de la config courante, pas de l'article.
3. **Préparer les références visuelles** (si image de départ / style à répliquer) :
   - Fichier local de l'appareil → `Higgsfield:media_upload_widget` (l'utilisateur choisit le fichier dans le navigateur). **Ne jamais demander d'uploader le fichier dans le chat Claude** : le MCP distant ne peut pas le lire.
   - URL web (image hébergée) → `Higgsfield:media_import_url`, puis récupérer le `media_id`.
   - Dans `generate_video`, `medias[].value` doit être un **media_id ou un job_id**, jamais une URL.
4. **Préflight du coût** → relancer `generate_video` avec `params.get_cost: true` pour connaître le coût crédits AVANT de soumettre. Indispensable pour respecter la règle d'or ci-dessous.
5. **Générer** → `Higgsfield:generate_video` avec :
   - `params.model: 'seedance_2_0'`
   - `params.prompt`: le prompt structuré (voir Anatomie)
   - `params.aspect_ratio`: `9:16` (Shorts/Reels/TikTok/WhatsApp Status) ou `16:9` (YouTube long / site web)
   - `params.duration`: une valeur supportée renvoyée par `models_explore` (l'article cite 4–15 s)
   - `params.count`: 1 en draft, jusqu'à 4 en variations
   - `params.medias`: optionnel — `[{value: <media_id>, role: 'start_image'}]` pour animer une image fixe, ou `role: 'image'` pour une référence de style
6. **Afficher / réutiliser un résultat** → `Higgsfield:job_display` avec le `job_id` (un seul ID par appel). Le `job_id` d'un clip réussi peut servir de référence (`medias[].value`) dans une génération suivante pour garder une continuité visuelle.

> **Multi-shot, transfert de mouvement ou audio piloté** : dans Higgsfield, `seedance_2_0` gère l'identité ; pour les séquences multi-plans, le motion-transfer ou un contrôle audio fin, le modèle `kling3_0` est souvent indiqué. Vérifier via `models_explore` ce que chaque modèle accepte avant de choisir. L'article annonce un audio natif Seedance : confirmer la disponibilité réelle dans Higgsfield via `models_explore` plutôt que de la supposer.

---

## Anatomie d'un prompt Seedance 2.0

Un bon prompt Seedance empile **6 couches** (toujours dans cet ordre logique) :

1. **Sujet + action** — ce qui se passe dans le plan.
2. **Mouvement caméra** — `slow push in`, `slow orbit`, `static locked-off shot`, `crane up`, `handheld micro-shake`, `dolly out`.
3. **Lumière** — `golden hour`, `neon noir`, `overcast soft light`, `studio key light`, `volumetric god rays`.
4. **Qualité de mouvement** — `fluid slow motion`, `time-lapse`, `normal speed`, `hyperlapse`.
5. **Ambiance (2–3 mots)** — `premium, aspirational` / `dramatic, cinematic` / `warm, hopeful`.
6. **Négatif** — terminer par : `--no text, watermarks, logos, distorted faces, extra limbs` (ajouter `, people` si la scène ne doit montrer personne).

**Techniques signature (deux outils distincts, à ne pas confondre)** :
- *Locked-off shot* — caméra parfaitement fixe pendant que le sujet, la lumière ou des détails vivent dans le cadre. Base cinématique propre, **disponible par défaut** sur n'importe quel prompt.
- *Transformation timelapse* — le monde dans le cadre se transforme en accéléré (vide → plein, chantier → bâti, désert → marché animé). **Modificateur à activer UNIQUEMENT quand Franck le demande explicitement.** Jamais par défaut. Chaque preset venture fournit la couche timelapse prête à ajouter, mais le prompt principal reste un plan cinématique sans transformation.

**Système @reference** : taguer une vidéo de marque uploadée pour répliquer ses mouvements caméra / style / chorégraphie sur un nouveau clip. Une seule vidéo de référence devient l'ADN visuel de toute une série. Dans Higgsfield, cela passe par `medias` (rôle `image` ou un `job_id` source).

**Langue du prompt** : rédiger les prompts modèle **en anglais** (Seedance les interprète mieux), même si tout le reste du travail est en français.

---

## La règle d'or des coûts

**Ne jamais lancer un rendu final en haute résolution directement.** Drafter d'abord en basse résolution / tier économique (l'article parle de 480p) pour valider mouvement, cadence et composition. Verrouiller en HD seulement une fois satisfait. Cette seule habitude coupe 40–60 % de dépense crédits le premier mois.

Workflow concret dans Higgsfield :
1. `get_cost: true` pour estimer.
2. Draft `count: 1` au tier le plus bas dispo.
3. Itérer le prompt jusqu'à ce que le mouvement soit bon.
4. Seulement alors, relancer en HD avec le prompt verrouillé.

---

## Invariants marché Sowax (à intégrer visuellement)

Quand le clip cible le marché gabonais/CEMAC, traduire les invariants en **éléments visuels** :
- **Mobile Money** → écran de téléphone montrant un paiement Airtel Money / Moov Money, logo opérateur stylisé.
- **WhatsApp-first** → interface de chat verte, bulle de message, commande passée en conversation.
- **FCFA** → prix/montants affichés en FCFA, jamais en €/$.
- **Contexte Gabon** → lumière équatoriale, décor de Libreville, personnages africains, ambiance CEMAC authentique (éviter le générique "Afrique" cliché).
- **OHADA / institutionnel** → pour Notarius/banque : esthétique sobre, papier officiel, sceau.

---

## Presets par venture

Pour générer un clip pour une marque Sowax, lire **`references/presets-ventures.md`** : il contient les prompts Seedance complets et prêts à coller pour **OhMyGab, DriveBy, Studia, KardAfrica** (+ gabarit Sowax Group), chacun avec son aspect ratio, sa durée et son esthétique recommandés. Adapter les crochets `[…]` au besoin précis, puis injecter dans `generate_video`.

## Méta-prompts réutilisables & monétisation

Pour la méthodologie chaîne faceless (validation de niche, génération de script Shorts, formats par plateforme, roadmap revenus, formule de viralité) : lire **`references/prompts-reutilisables.md`**.

---

## Check-list avant chaque génération

- [ ] `models_explore` lancé → aspect ratios / durées / rôles medias confirmés
- [ ] Prompt en anglais, 6 couches présentes, négatif inclus
- [ ] Invariants marché traduits en visuel (si cible CEMAC)
- [ ] Références uploadées via widget/import_url, media_id récupéré
- [ ] `get_cost` vérifié, draft basse résolution d'abord
- [ ] Aspect ratio = plateforme cible (9:16 social / 16:9 site)
