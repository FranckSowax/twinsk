---
name: motion-website-sowax
description: Pipeline pour construire un site ou une section web cinématographique scroll-driven à partir de clips motion générés via le MCP Higgsfield, puis assemblés en Claude Code (extraction de frames, animations CSS/JS, déploiement). Utilise CE skill dès que l'utilisateur veut un site animé, une landing page motion, une hero section cinématographique, un site scroll-driven, un effet "scrollytelling", un site qui s'anime au scroll, ou veut transformer une vidéo/clip en page web animée — pour une marque Sowax (OhMyGab, DriveBy, Studia, KardAfrica, Notarius, etc.) ou un client. Couvre le setup MCP Higgsfield (Claude Code + desktop), la génération des clips, l'extraction de frames, les animations scroll (GSAP ScrollTrigger + Lenis), les 6 effets cinématiques (film grain, particules, vignette, glass cards, color tints, scroll pacing), et le déploiement (Netlify/Vercel/GitHub Pages). Pour générer les clips eux-mêmes, s'appuie sur le skill seedance-cinematic-sowax.
---

# Motion Website — Pipeline cinématographique Sowax (Higgsfield + Claude Code)

Skill pour passer d'un **brand kit + brief** à un **site scroll-driven animé déployé**, en une session agentique. Le moteur : MCP Higgsfield génère les clips motion → Claude Code extrait les frames, écrit le HTML/CSS/JS et assemble le site → déploiement → itération dans le même chat.

> **Note d'honnêteté.** L'article source décrit un skill officiel Higgsfield ("Motion Website Generator" + moteur "Vibe Motion") qui automatiserait l'extraction de frames. CE skill-ci est une version **transparente et contrôlable** qui reproduit le même pipeline explicitement, taillée pour Sowax. Si le skill officiel Higgsfield est disponible et mieux intégré, il peut être utilisé à la place ; celui-ci garantit que tu maîtrises chaque étape.

## Le pipeline en une ligne

```
Brand kit + brief  →  Higgsfield MCP (clips motion)  →  Claude Code (frames + CSS scroll)  →  Site live (deploy + itère en chat)
```

Six effets cinématiques appliqués au site : **film grain · particules · vignette · glass cards · color tints · scroll pacing** (détails et code dans `references/pipeline-technique.md`).

---

## Étape 0 — Setup du MCP Higgsfield (une fois)

**Claude Code (terminal)** — la voie recommandée pour ce skill :
```
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```
Au premier usage, Claude Code ouvre un navigateur pour l'OAuth. Vérifier la connexion avec `claude mcp list` ou la commande `/mcp` — on doit voir **higgsfield** connecté.

**Claude desktop / web** (alternative) : Réglages → Connecteurs → *Add custom connector*, le nommer **Higgsfield**, coller `https://mcp.higgsfield.ai/mcp`, se connecter (OAuth), puis passer read/write sur **Always Allow** pour que la boucle de build tourne sans validations.

Un compte Higgsfield neuf embarque des crédits gratuits : les premiers builds ne coûtent rien. Le MCP tourne sur ces crédits, rien d'autre à installer.

---

## Étape 1 — Recueillir le brand kit + brief

Avant toute génération, réunir (voir gabarit complet dans `references/brief-et-vente.md`) :
- **Logo** (fichier ou URL), **couleurs** (4–6 hex), **typographies** (display + body), **références visuelles**.
- **Brief business** : que fait la marque, audience cible, le **job unique** de la page (vendre / inscrire / rassurer / faire agir).
- **Sections** souhaitées (hero, preuve, offre, CTA…).
- **Invariants marché Sowax** si cible CEMAC : Mobile Money, WhatsApp-first, FCFA, contexte Gabon (à traduire visuellement, voir plus bas).

Si le brief ne fixe pas une direction visuelle, la fixer soi-même et l'annoncer (cf. principes de design ci-dessous).

---

## Étape 2 — Générer les clips motion (via seedance-cinematic-sowax)

Chaque section animée du site = un clip motion source. **Utiliser le skill `seedance-cinematic-sowax`** pour produire les prompts JSON et piloter `Higgsfield:generate_video` (modèle `seedance_2_0`, ou `kling3_0` pour multi-plans). Régler :
- `aspect_ratio` selon la section (16:9 hero plein écran, 9:16 mobile, 1:1 carte).
- Clips courts et **bouclables** (début ≈ fin) pour les fonds animés.
- Drafter en basse résolution (règle des coûts), verrouiller en HD une fois la composition validée.
- Récupérer le `job_id`/l'URL du clip rendu pour l'étape suivante.

Pour un site Sowax, mapper une venture → son preset (OhMyGab, DriveBy, Studia, KardAfrica dans `references/presets-ventures.md` du skill clip).

---

## Étape 3 — Extraire les frames + écrire le scroll (Claude Code)

C'est le cœur technique, détaillé dans **`references/pipeline-technique.md`** :
1. **Télécharger** le clip rendu (depuis l'URL Higgsfield).
2. **Extraire les frames** avec ffmpeg (`fps`, `scale`, format `.jpg`/`.webp`).
3. **Optimiser** les frames (poids web, dimensions cohérentes).
4. **Animation séquence-au-scroll** : précharger les frames, dessiner sur un `<canvas>`, mapper la progression de scroll → index de frame via **GSAP ScrollTrigger** (technique "Apple product page").
5. **Scroll fluide** avec **Lenis**, synchronisé à ScrollTrigger.
6. **Reveals** de sections (fade/slide au scroll), pacing maîtrisé.

Avant d'écrire le markup, lire le skill **frontend-design** (`/mnt/skills/public/frontend-design/SKILL.md`) et en appliquer les principes : hero = thèse, typographie porteuse d'identité, un seul élément signature, éviter les défauts templated.

---

## Étape 4 — Les 6 effets cinématiques

Appliqués par-dessus la structure (code complet dans `references/pipeline-technique.md`) :
1. **Film grain** — overlay de bruit (SVG fractalNoise ou texture), `mix-blend-mode`, faible opacité.
2. **Particules** — système de particules léger en canvas (poussières/lucioles flottantes).
3. **Vignette** — overlay `radial-gradient` plein écran, `pointer-events:none`.
4. **Glass cards** — `backdrop-filter: blur()` + fond semi-transparent + bordure fine.
5. **Color tints** — overlay de teinte qui évolue au scroll (`mix-blend-mode`).
6. **Scroll pacing** — réglage Lenis (durée/easing) + valeurs `scrub`/snap GSAP.

Discipline : **un seul élément signature** doit dominer ; les effets soutiennent, ne saturent pas. Respecter `prefers-reduced-motion` (désactiver les animations lourdes), focus clavier visible, responsive mobile.

---

## Étape 5 — Déployer + itérer

Sortie = **HTML/CSS/JS standard, aucun runtime propriétaire**. Déploiement en une minute :
- **Netlify Drop** — glisser le dossier.
- **Vercel** — import & deploy.
- **GitHub Pages** — push & enable.

Le vrai déblocage : **continuer à itérer dans le même chat**. "Resserre le hero", "remplace la section 3 par un bloc tarifs", "ralentis le scroll" — prompts en langage naturel, sans re-trigger ni ré-export. Pour des correctifs précis, fournir une capture d'écran.

---

## Invariants marché Sowax (traduction visuelle)

Pour un site ciblant le marché gabonais/CEMAC :
- **Mobile Money** → section paiement montrant Airtel/Moov, écran de confirmation.
- **WhatsApp-first** → CTA "Commander sur WhatsApp", bulle de chat, lien `wa.me`.
- **FCFA** → tous les prix en FCFA.
- **Contexte Gabon** → imagerie Libreville/CEMAC authentique, personnages africains, lumière équatoriale.
- **OHADA / institutionnel** (Notarius, banque) → esthétique sobre, sceau, papier officiel.

---

## Positionnement & revenus

L'angle commercial (portfolio de démos, reskin pour scaler, cibles SMB gabonaises) est dans **`references/brief-et-vente.md`**. Les chiffres de revenus de l'article (jusqu'à $38 400/mois) sont une **borne théorique, pas une promesse** — la valeur réelle vient de la vitesse de livraison et de la qualité.

---

## Check-list avant livraison

- [ ] MCP Higgsfield connecté (`claude mcp list` montre higgsfield)
- [ ] Brand kit + brief recueillis, direction visuelle annoncée
- [ ] Clips générés via seedance-cinematic-sowax, draft basse résolution d'abord
- [ ] Frames extraites + optimisées (poids web maîtrisé)
- [ ] Scroll fluide (Lenis) synchronisé à GSAP ScrollTrigger
- [ ] 6 effets dosés, un seul élément signature dominant
- [ ] `prefers-reduced-motion`, focus clavier, responsive mobile
- [ ] Invariants marché Sowax traduits en visuel (si cible CEMAC)
- [ ] Déployé, prêt à itérer dans le même chat
