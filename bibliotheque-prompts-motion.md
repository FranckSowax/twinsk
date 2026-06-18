# 🎬 Bibliothèque de Prompts Motion — Sowax Group Edition

> Prompts originaux, prêts à l'emploi, calibrés pour Claude (et compatibles avec tout autre outil IA de génération de code). Les prompts sont en anglais (meilleurs résultats avec les modèles), les notes d'usage en français.
>
> **Règle d'or** : un prompt = un fichier HTML autonome (HTML + CSS + JS dans un seul fichier). Toujours demander "single self-contained HTML file" pour pouvoir prévisualiser immédiatement.

---

# PARTIE 1 — Les 9 effets fondamentaux

---

## EFFET 1 — Hero avec texte révélé au scroll (Text Scroll Reveal)

**Ce que ça fait** : le titre du hero est immense ; quand on scrolle, les lignes de texte glissent vers le bas/se désassemblent avec un masque, créant une transition cinématique vers la section suivante.

```
Build a single self-contained HTML file (HTML + CSS + vanilla JS, no libraries except GSAP via CDN with ScrollTrigger).

HERO SECTION — "text scroll reveal":
- Pure black background (#000), no gradients anywhere.
- A minimal navbar: logo text on the left, 3 links + one pill-shaped CTA button on the right. Navbar has a subtle bottom border (rgba(255,255,255,0.08)).
- The hero headline is massive: clamp(3.5rem, 11vw, 10rem), uppercase, tight letter-spacing (-0.03em), line-height 0.95, split across 2–3 lines.
- Each line of the headline lives inside an overflow:hidden wrapper. On page load, lines slide UP into view one by one (staggered 120ms, cubic-bezier(0.22, 1, 0.36, 1), 900ms).
- On scroll, tie a ScrollTrigger timeline to the hero: each headline line translates DOWN and out of its mask at a different speed (staggered parallax), while opacity stays at 1 — the mask does the hiding, not the opacity.
- A small overline label above the headline (12px, letter-spacing 0.2em, uppercase, color rgba(255,255,255,0.5)).
- A scroll indicator at the bottom center: thin vertical line that loops a subtle scaleY animation.
- Below the hero, add ONE simple placeholder section (just so the scroll effect is visible), same black background.
- Respect prefers-reduced-motion: disable all animations if set.
- Fully responsive down to 360px wide.
Typography: use "Space Grotesk" for the headline and "Inter" for everything else (Google Fonts).
```

**Personnalisation** : remplace les polices, le texte du headline, et la vitesse de stagger. Pour un rendu plus "luxe", passe le headline en serif (ex: "Fraunces").

---

## EFFET 2 — Mask Reveal au scroll (image dévoilée de bas en haut)

**Ce que ça fait** : deux images superposées au centre de la page ; en scrollant, un masque révèle progressivement la deuxième image de bas en haut. C'est l'effet exact de la vidéo.

```
Build a single self-contained HTML file (HTML + CSS + vanilla JS, GSAP + ScrollTrigger via CDN).

SCROLL-TIED MASK REVEAL:
- Pure black background.
- Two images stacked perfectly on top of each other, centered on the page, about 80% of viewport height, identical position and size:
  - BASE image (visible by default): [URL_IMAGE_DE_BASE]
  - REVEAL image (hidden, revealed on scroll): [URL_IMAGE_REVEAL]
- The reveal image sits above the base image and is masked with clip-path: inset(100% 0 0 0) initially (fully hidden).
- Create a pinned scroll section (ScrollTrigger pin, scrub: 1, duration ~150vh of scrolling): as the user scrolls, animate the clip-path to inset(0% 0 0 0) so the reveal image is unveiled from BOTTOM to TOP, like a rising curtain.
- Add a thin horizontal line of light (2px, white, subtle blur/glow) that tracks the reveal edge — it moves up with the mask boundary, like a scanner line.
- While pinned, the headline text behind/above the image slowly drifts down and fades to 40% opacity.
- After the pin ends, scrolling continues normally to the next section.
- prefers-reduced-motion: show the reveal image statically, no pin.
- Responsive: on mobile the images take 90vw width, height auto, effect preserved.
```

**Personnalisation** : remplace les deux URLs. Variante : inverse le sens (`inset(0 0 100% 0)` → révélation de haut en bas), ou révèle latéralement.

---

## EFFET 3 — Mouse Reveal (image révélée au curseur)

**Ce que ça fait** : une image cachée n'apparaît que dans un cercle qui suit la souris — effet "lampe torche".

```
Build a single self-contained HTML file (HTML + CSS + vanilla JS, no libraries).

CURSOR SPOTLIGHT REVEAL:
- Pure black background, full-viewport section.
- Two images stacked exactly on top of each other, centered, ~75vh tall:
  - BASE image: [URL_IMAGE_DE_BASE]
  - HIDDEN image: [URL_IMAGE_REVEAL]
- The hidden image is masked with a radial mask that follows the cursor:
  use CSS mask-image: radial-gradient(circle 180px at var(--x) var(--y), black 0%, black 60%, transparent 100%) — soft feathered edge, not a hard circle.
- JS updates --x and --y on mousemove with a LERP smoothing factor of 0.12 (the circle lags slightly behind the cursor, requestAnimationFrame loop).
- When the cursor leaves the section, the circle shrinks to 0 over 400ms.
- On touch devices, fall back to: the circle follows touchmove, and a gentle automatic circular sweep plays when idle.
- Add a custom cursor: hide the default cursor inside the section, show a small 8px white dot instead.
- prefers-reduced-motion: show both images side by side statically.
```

**Personnalisation** : taille du cercle (`180px`), douceur du bord (`60%`), inertie (`0.12`). Variante premium : deux cercles de tailles différentes pour un effet de profondeur.

---

## EFFET 4 — E-commerce 3D interactif

**Ce que ça fait** : un produit en 3D au centre du hero, qui tourne avec la souris, avec des hotspots cliquables. Utilise Three.js avec une géométrie procédurale (pas besoin de fichier 3D).

```
Build a single self-contained HTML file using Three.js (CDN, r160+ module via importmap).

3D PRODUCT HERO:
- Pure black background. Layout: headline + subtext + CTA on the LEFT (45% width), 3D canvas on the RIGHT (55%).
- In the canvas, build a stylized product from primitive geometries (e.g. a sleek perfume bottle: rounded box body + cylinder cap + torus detail), with a physically-based material: metalness 0.9, roughness 0.15, env-lit with a generated RoomEnvironment.
- Lighting: one key directional light (warm), one rim light (cool blue) behind the object, subtle ambient.
- The product floats: gentle idle rotation (0.15 rad/s on Y) + a slow sine-wave vertical bob (±0.05 units).
- Mouse parallax: moving the mouse tilts the product up to ±12° on X/Y with LERP smoothing (0.06).
- Three pulsing hotspot dots anchored to 3D positions on the product, projected to screen space. Hovering a hotspot opens a small glassmorphism tooltip (feature name + one line).
- Below the product: a row of 3 color swatches. Clicking a swatch smoothly transitions the product material color over 600ms.
- A soft circular reflection/shadow under the product (radial gradient div, not 3D).
- 60fps target: pixelRatio capped at 2, antialias on, no postprocessing.
- Responsive: on mobile, stack vertically (text on top, canvas 50vh below), drag to rotate instead of mouse parallax.
- prefers-reduced-motion: idle rotation off, drag-to-rotate only.
```

**Personnalisation** : décris ton produit en primitives ("a car silhouette from boxes", "a gift card as a thin rounded box"). Pour DriveBy : une voiture stylisée low-poly.

---

## EFFET 5 — Backgrounds animés (3 variantes)

### 5A — Gradient mesh organique

```
Build a single self-contained HTML file. Create an animated "aurora mesh" background:
- 4 large radial-gradient blobs (each 60–80vw), heavily blurred (filter: blur(90px)), in deep tones: indigo #1e1b4b, violet #4c1d95, teal #134e4a, plus one accent.
- Each blob drifts on its own slow keyframe path (40–70s loops, different durations so they never sync), with slight scale breathing (0.9 → 1.1).
- Overlay a fine noise texture (SVG feTurbulence as a data-URI, opacity 0.04, mix-blend-mode: overlay) to kill banding.
- Content sits above: one centered headline to prove readability.
- GPU-friendly: animate only transform, will-change: transform, no JS.
```

### 5B — Particules constellation

```
Single self-contained HTML file, vanilla JS canvas:
- Black background, ~90 particles (1–2px, white, opacity 0.3–0.8) drifting slowly.
- Lines connect particles closer than 120px, line opacity proportional to proximity.
- The cursor acts as a gentle repulsor (radius 100px).
- Cap at 60fps with requestAnimationFrame; reduce to 40 particles below 768px width.
- prefers-reduced-motion: static dots, no lines.
```

### 5C — Grille technique qui respire

```
Single self-contained HTML file, CSS only:
- Black background with a faint blueprint grid (1px lines, rgba(255,255,255,0.05), 64px cells) drawn with two repeating-linear-gradients.
- A radial "breathing" spotlight in the center (radial-gradient, white at 3% opacity) that scales 1 → 1.15 → 1 over 8s.
- One grid cell randomly "lights up" every few seconds (JS picks a cell, flashes a border glow for 1.2s).
```

---

## EFFET 6 — Parallax multi-couches

```
Build a single self-contained HTML file (GSAP + ScrollTrigger via CDN).

LAYERED PARALLAX SCENE:
- A tall hero (130vh) with 4 absolutely-positioned layers, back to front:
  L1 background image (slowest, moves -10% over the scroll),
  L2 midground large display text (moves -25%),
  L3 foreground image, partially overlapping the text (moves -45%),
  L4 a small floating caption card (moves -65%).
- Each layer is driven by one ScrollTrigger with scrub: 0.8 — buttery, no jank: transform: translate3d only.
- The foreground image OVERLAPS the display text so the text appears to pass BEHIND it while scrolling (depth illusion).
- Subtle scale on the background (1 → 1.08) for cinematic depth.
- Use placeholder images from picsum.photos. Pure black page background, the scene framed with 4vw margins.
- prefers-reduced-motion: all layers static.
```

**Personnalisation** : remplace les picsum par tes assets. Le truc qui fait pro : le texte qui passe *derrière* l'image de premier plan.

---

## EFFET 7 — Marquee infini premium

```
Build a single self-contained HTML file (CSS animation, tiny JS for hover).

INFINITE MARQUEE BAND:
- A full-width horizontal band on black background, top and bottom hairline borders (rgba(255,255,255,0.1)).
- Inside: a row of items (word + small dot separator), duplicated enough times for a seamless loop.
- Seamless technique: the track contains the item list TWICE, animated translateX(0 → -50%) on a linear infinite loop (28s).
- On hover: the animation slows to 30% speed (transition animation-duration is not possible — use a JS-driven playbackRate via Web Animations API instead).
- Items: 1.6rem uppercase, letter-spacing 0.08em, color rgba(255,255,255,0.65); the separator dot is a 6px accent-colored circle.
- Add a SECOND band right below, scrolling in the opposite direction at a slightly different speed.
- Edge fade: 80px mask-image linear-gradient fades on both sides.
```

**Personnalisation** : remplis avec tes verticales ("E-COMMERCE • LOGISTICS • EDUCATION • FINTECH • MOBILITY") — parfait pour un site holding Sowax Group.

---

## EFFET 8 — Cards magnétiques + micro-interactions

```
Build a single self-contained HTML file (vanilla JS).

MAGNETIC FEATURE CARDS:
- Black background, a 3-column grid of 6 cards (1 column on mobile).
- Card base style: rgba(255,255,255,0.03) background, 1px rgba(255,255,255,0.08) border, 20px radius, 32px padding. NO drop shadows.
- MAGNETIC effect: when the cursor is within 120px of a card, the card translates up to 8px toward the cursor (LERP 0.1) and tilts up to 4° (rotateX/rotateY) based on cursor position relative to card center. Smoothly returns to rest when the cursor leaves.
- SPOTLIGHT border: each card has a pseudo-element with a radial-gradient (accent color, 25% opacity) centered at the cursor position (CSS vars --mx/--my updated on mousemove), masked to only show along the border — the border appears to "light up" where the cursor is.
- Inside each card: a minimal line icon (inline SVG), a title (1.1rem semibold), two lines of muted text.
- Card content lifts 2px on hover with a 250ms ease.
- Touch devices: no magnetism, a simple press state (scale 0.98).
```

---

## EFFET 9 — Compteurs + révélations à l'entrée (section "preuves")

```
Build a single self-contained HTML file (vanilla JS, IntersectionObserver).

STATS REVEAL SECTION:
- Black background, a centered row of 4 big numbers with small labels.
- Numbers: clamp(2.5rem, 6vw, 5rem), tabular-nums, accent color; labels 12px uppercase muted.
- When the section enters the viewport (threshold 0.4), each number counts up from 0 to its target over 1.6s with easeOutExpo, staggered 150ms. Runs once.
- Each stat block also fades in + rises 24px on entry.
- Above the stats, a section heading is revealed word by word (each word in an overflow-hidden span, sliding up, 60ms stagger).
- prefers-reduced-motion: final values shown immediately.
```

---

# 💡 Comment combiner les effets

La recette de la vidéo, généralisée :

1. **Prompt 1** : Hero (Effet 1) → prévisualiser
2. **Prompt 2** : "Add to the existing file:" + Effet 2 ou 3 avec tes images → prévisualiser
3. **Prompt 3** : "Now build the rest of the landing page: 3–4 sections, same fonts, same pure black background, no gradients" + Effets 7, 8, 9
4. **Ajustements** : un prompt court par retouche ("make the images 20% smaller", "slow the marquee down")

**Ne jamais tout demander en un seul prompt** : itérer section par section donne un contrôle total et des résultats plus propres.

---

# PARTIE 2 — Hero sections sur mesure pour tes projets

> Chaque prompt est autonome et encode une direction artistique distincte par marque — pas un template noir générique décliné 8 fois. Les textes (headlines, CTA) sont en français puisque c'est ta langue de marché ; tu peux les ajuster.

---

## 🛒 OhMyGab — Marketplace e-commerce Gabon

**Direction** : énergie marchande, chaleur équatoriale, mobile-first assumé. L'effet signature : un carrousel de produits qui défile en diagonale derrière le titre.

```
Build a single self-contained HTML file (HTML + CSS + vanilla JS, GSAP via CDN).

HERO — OhMyGab, the leading e-commerce marketplace in Gabon:
- Background: deep warm charcoal #141210 (not pure black — this brand is warm).
- Accent palette: mango #FFB020 and forest green #1F7A4D. Use mango for the CTA, green for small details only.
- Typography: "Sora" (bold, display) + "Inter" (body), Google Fonts.
- SIGNATURE: two DIAGONAL marquee bands (rotated -8°) crossing the hero behind the text, filled with product category chips in French ("Téléphones", "Mode", "Électroménager", "Beauté", "Maison", "Enfants") — each chip is a pill with a tiny emoji icon. Bands scroll in opposite directions, 35s loops, opacity 0.25 so the headline stays dominant.
- Headline (centered, above the bands): "Tout le Gabon. Livré chez vous." — clamp(2.8rem, 8vw, 6.5rem), with "Livré chez vous." in mango.
- Sub-line: "Des milliers de produits, paiement Airtel Money & Moov Money, livraison à Libreville et partout au Gabon."
- Two CTAs: solid mango pill "Découvrir la marketplace" + ghost button "Vendre sur OhMyGab".
- Below CTAs, a trust row: three small inline items with icons — "Paiement Mobile Money", "Livraison 24-72h", "Vendeurs vérifiés".
- Page-load: headline words slide up from masks (stagger 80ms), then the bands fade in, then CTAs rise.
- Mobile: bands become horizontal, headline scales down, everything stacks. WhatsApp floating button bottom-right (green circle, white icon).
```

---

## 🚗 DriveBy Africa — Import de véhicules

**Direction** : cinématique automobile, phares dans la nuit, précision. Effet signature : un faisceau de lumière qui balaye une silhouette de voiture au scroll.

```
Build a single self-contained HTML file (GSAP + ScrollTrigger via CDN).

HERO — DriveBy Africa, vehicle import platform (Asia/Dubai → Africa):
- Pure black background #000. Accent: headlight amber #FFC83D, used surgically.
- Typography: "Archivo Expanded" or "Archivo" wide weights (display, uppercase) + "Inter" (body).
- SIGNATURE — "headlight sweep": a wide car silhouette drawn as an inline SVG (clean side profile, thin 1.5px white strokes at 20% opacity) centered in the hero. A masked amber light beam (a blurred gradient shape) sweeps across the silhouette tied to scroll (scrub) — where the beam passes, the strokes light up to 90% opacity and gently glow, then dim behind it.
- Headline above the car: "Votre véhicule. De l'usine à votre porte." — uppercase, clamp(2.4rem, 7vw, 5.5rem), letter-spacing -0.02em.
- Overline: "IMPORT • INSPECTION • DOUANE • LIVRAISON" as a small letter-spaced label.
- Sub: "Importez depuis la Chine, le Japon et Dubaï en toute transparence. Suivi en temps réel, dédouanement inclus."
- CTAs: amber pill "Estimer mon import" + ghost "Voir les véhicules disponibles".
- A thin horizontal progress line under the car fills as the sweep advances (like a loading bar synced to the scroll).
- A stats strip pinned at the hero's bottom edge: "500+ véhicules livrés · 4 pays · Délai moyen 45 jours" (counts up on load).
- Mobile: the sweep is driven by a slow automatic loop instead of scroll.
```

---

## 🎁 KardAfrica — Cartes cadeaux digitales

**Direction** : joyeux, gestuel, couleur. Effet signature : un éventail de cartes 3D qui se déploie au chargement et réagit à la souris.

```
Build a single self-contained HTML file (vanilla JS, CSS 3D transforms).

HERO — KardAfrica, digital gift cards for Africa:
- Background: very dark plum #16101E. Confetti-tone accents: coral #FF6B6B, gold #FFD166, mint #06D6A0 — one per card.
- Typography: "Clash Display" via Fontshare (or "Space Grotesk" fallback) + "Inter".
- SIGNATURE — "card fan": three gift-card rectangles (340×214px, 18px radius, subtle brand-like face designs built in pure CSS: each a different accent color with a fine pattern and a small chip + logo placeholder). On load they deal out from a stacked deck into a fan (rotations -12°/0°/+12°, slight Y offsets), 700ms spring-like ease, staggered.
- Mouse parallax on the fan: the whole group tilts up to 10° (rotateX/rotateY) following the cursor with LERP 0.08; each card also shifts slightly at a different rate (depth).
- Hovering a single card lifts it 14px and brings it to front.
- Layout: text LEFT (50%), card fan RIGHT (50%).
- Headline: "Offrez plus qu'un cadeau." with "cadeau" wrapped in a hand-drawn SVG circle that draws itself (stroke-dashoffset animation) 600ms after load.
- Sub: "Cartes cadeaux digitales des meilleures marques, livrées par WhatsApp en quelques secondes. Payez par Mobile Money."
- CTA: gradient-free solid coral pill "Envoyer une carte" + ghost "Pour les entreprises".
- Mobile: fan becomes a gentle auto-rotating carousel, text on top.
```

---

## 🎓 Studia — Éducation & China Pass

**Direction** : trajectoire, horizon, sérieux optimiste. Effet signature : une ligne de parcours qui se dessine de Libreville à Shanghai.

```
Build a single self-contained HTML file (vanilla JS, SVG animation, IntersectionObserver).

HERO — Studia China Pass: Gabonese students enrolling in Chinese universities:
- Background: deep academic navy #0A1228. Accents: gold #E8B84B + jade #2BAE8E.
- Typography: "Fraunces" (display serif — this brand is institutional and aspirational) + "Inter".
- SIGNATURE — "the journey line": a wide inline SVG spanning the hero's lower half showing a minimal dotted world-route: a point labeled "Libreville" on the left, an elegant curved flight path, a point labeled "Shanghai / Pékin / Wuhan" on the right. The path draws itself on load (stroke-dasharray/offset, 2.2s ease-in-out), then a small plane glyph travels along it once; small gold pulses ripple at each endpoint.
- Headline: "De Libreville aux plus grandes universités de Chine." — serif, clamp(2.4rem, 6.5vw, 5rem), "Chine" in gold italic.
- Sub: "Admission, visa, bourses CSC et accompagnement complet. Studia China Pass ouvre la voie."
- A 4-step mini-timeline under the sub (Dossier → Admission → Visa → Départ): each step is a small numbered node on a horizontal line; nodes light up sequentially after the path finishes drawing.
- CTAs: gold pill "Commencer mon dossier" + text link "Découvrir les bourses →".
- Soft paper-grain noise overlay (3% opacity) for warmth.
- Mobile: the route becomes vertical (top = Libreville, bottom = Chine), timeline stacks.
```

---

## ⚖️ Notarius — SaaS notarial

**Direction** : rigueur, papier, encre — du juridique qui respire la confiance. Effet signature : un sceau qui s'appose et un document qui se "compile" ligne par ligne.

```
Build a single self-contained HTML file (vanilla JS).

HERO — Notarius, SaaS for notarial offices (OHADA law, Gabon):
- Background: warm off-black ink #101010 with a very subtle vertical paper texture (CSS repeating-linear-gradient, 2% opacity). Accent: a single deep bordeaux #7A1F2B; secondary: bone white #EDE8E0 for text.
- Typography: "Cormorant Garamond" (display — legal gravitas) + "IBM Plex Sans" (body) + "IBM Plex Mono" for document snippets.
- Layout: text LEFT, a stylized document card RIGHT.
- SIGNATURE — "the living deed": the right-side card looks like a notarial act (bone-white background, generous margins, a thin double-rule border). Its content TYPES ITSELF: mono-font lines appear one by one (a realistic typing/compile effect, ~14 short redacted-style lines, some bold headers like "ACTE DE NOTORIÉTÉ", some grey bars standing for body text). When the last line lands, a circular SEAL stamps onto the bottom-right corner: it scales from 1.6 to 1 with a quick impact ease + a subtle 1px page shake, bordeaux ring with "NOTARIUS" in small caps around it.
- Headline: "L'étude notariale, augmentée." — serif, clamp(2.4rem, 6vw, 4.8rem).
- Sub: "Rédaction d'actes assistée par IA, base juridique OHADA intégrée, archivage sécurisé. Conçu pour les offices notariaux d'Afrique centrale."
- CTAs: bordeaux pill "Demander une démonstration" + ghost "Voir Notarius en 2 minutes".
- Trust line: "Conforme OHADA · Hébergement souverain · Support à Libreville".
- Reduced motion: the deed appears complete, seal static. Mobile: document card below the text, 90vw.
```

---

## 💳 Kartelle.io — SaaS fidélité

**Direction** : produit SaaS vif, démonstration immédiate. Effet signature : une carte de fidélité qui se tamponne en boucle.

```
Build a single self-contained HTML file (vanilla JS).

HERO — Kartelle.io, digital loyalty cards for African merchants:
- Background: near-black #0B0D10. Accent: electric violet #7C5CFF + lime #C8F560 (use lime ONLY for the stamp moments).
- Typography: "Space Grotesk" + "Inter".
- Layout: text LEFT, a phone mockup RIGHT (pure CSS phone frame, 300×620, rounded 44px, thin bezel).
- SIGNATURE — "the stamp loop": inside the phone, a loyalty card UI (merchant name, a 2×5 grid of stamp slots). Every 1.8s, the next slot receives a stamp: a lime circle pops in with a spring scale (1.4 → 1) + a tiny radial burst of 6 particles. When all 10 fill, a "Récompense débloquée 🎉" banner slides down, holds 1.5s, then the card resets and the loop restarts.
- A floating WhatsApp-style notification card appears next to the phone at loop completion: "Votre client vient de gagner un café offert ☕".
- Headline: "Vos clients reviennent. Automatiquement." — clamp(2.4rem, 6.5vw, 5rem), "Automatiquement." in violet.
- Sub: "Cartes de fidélité digitales sur WhatsApp et Apple/Google Wallet. Sans application à installer. Activées en 5 minutes."
- CTAs: violet pill "Créer ma carte gratuitement" + text "Voir une démo →".
- Stats row: "+34% de clients récurrents · 5 min d'installation · 0 application requise".
- Mobile: phone below text, loop preserved.
```

---

## 📰 Gabon Insight — Agrégateur d'actu IA

**Direction** : flux, temps réel, signal dans le bruit. Effet signature : un ticker de titres qui se "matérialise" depuis un flux de caractères.

```
Build a single self-contained HTML file (vanilla JS).

HERO — Gabon Insight, AI-powered news intelligence for Gabon:
- Background: pure black. Accent: signal green #29E07C (terminal heritage) + white. Monochrome otherwise.
- Typography: "Inter" tight (display, -0.04em) + "JetBrains Mono" for the data layer.
- SIGNATURE — "decode effect": the headline "L'actualité du Gabon, décodée par l'IA." materializes through a character-scramble: each letter cycles through random mono glyphs for ~500ms before locking into place, left to right (classic decode/matrix-text effect, subtle and fast — total under 1.6s).
- Behind the content, a faint vertical stream of mono-font headlines (real-sounding French placeholders: "Conseil des ministres : les décisions clés", "CAN 2026 : les Panthères en préparation", "Nouveau cadre fiscal pour les PME"...) slowly scrolls upward at 4% opacity — texture, not noise.
- A live-feel ticker bar pinned under the navbar: green dot pulsing + "EN DIRECT" + a marquee of 5 headlines separated by " /// ".
- Sub: "Toute la presse gabonaise agrégée, résumée et analysée en temps réel. Bulletins audio chaque matin."
- CTAs: green pill "Recevoir le brief quotidien" + ghost "Explorer les analyses".
- A small mono badge row: "RSS ×40 sources · Résumés IA · Audio · WhatsApp".
- Reduced motion: headline appears instantly, stream static.
```

---

## 🚢 Twinsk — Sourcing & logistique Chine-Afrique

**Direction** : flux physiques, conteneurs, fiabilité industrielle. Effet signature : une trajectoire de conteneur animée sur une carte stylisée.

```
Build a single self-contained HTML file (SVG + vanilla JS, GSAP via CDN).

HERO — Twinsk, China–Africa sourcing and logistics:
- Background: deep sea slate #0C141A. Accents: container orange #F2762E + steel blue #5B89A6.
- Typography: "Archivo" (semi-expanded, uppercase display) + "Inter".
- SIGNATURE — "the route map": a wide minimal SVG map area (no real geography needed — abstract dotted coastlines suggesting Asia on the right, Central Africa on the left). A shipping route (curved dashed path) animates a small orange container-ship marker from "Shenzhen" to "Libreville" on an 8s loop; the path draws ahead of the ship and fades behind it. Port nodes pulse when the ship departs/arrives. Two small waypoint labels en route: "Singapour", "Pointe-Noire".
- Headline: "De l'usine en Chine à votre entrepôt." — uppercase, clamp(2.2rem, 6vw, 4.6rem).
- Overline: "SOURCING • CONTRÔLE QUALITÉ • FRET • DÉDOUANEMENT".
- Sub: "Twinsk source, inspecte et achemine vos marchandises. Un seul interlocuteur, de la commande à la livraison."
- CTAs: orange pill "Obtenir un devis de sourcing" + ghost "Suivre une expédition".
- A compact 3-up metric row: "1 200+ conteneurs traités · 15 jours de transit moyen · QC sur site en usine" (counts up on load).
- Mobile: map becomes 60vh, route vertical (top Asia → bottom Africa), text above.
```

---

## 🏛 Sowax Group — Holding (bonus)

**Direction** : architecture d'un écosystème. Effet signature : une constellation de filiales qui s'assemble autour du logo.

```
Build a single self-contained HTML file (vanilla JS canvas + DOM).

HERO — Sowax Group, multi-venture holding (Libreville · Dakar · Shenzhen):
- Pure black, monochrome white + one champagne accent #D8C39A. Extreme restraint.
- Typography: "Fraunces" light (display serif) + "Inter".
- SIGNATURE — "the ecosystem constellation": at center, the word "SOWAX" in large serif. Around it, 8 small nodes (subsidiary names in 11px uppercase: OHMYGAB, DRIVEBY, STUDIA, TWINSK, KARTELLE, KARDAFRICA, GABON INSIGHT, NOTARIUS) positioned on an invisible ellipse. On load, thin 1px lines draw from the center to each node sequentially (120ms stagger); each node fades in as its line arrives. The whole constellation then breathes: nodes drift ±4px on slow individual sine waves, lines re-render each frame on a canvas behind the DOM labels.
- Hovering a node: its line brightens to the champagne accent and a one-line descriptor fades in beneath the constellation ("E-commerce leader au Gabon", "Import de véhicules", ...).
- Headline under the constellation: "Construire les infrastructures de la consommation africaine." — 1.6rem, max-width 34ch, centered, muted.
- One quiet text link: "Découvrir le groupe →" (champagne underline that draws on hover).
- Three city labels pinned at the very bottom: "LIBREVILLE — DAKAR — SHENZHEN" letter-spaced.
- Reduced motion: constellation rendered complete and static.
```

---

# 📌 Conseils d'exécution

1. **Un projet = un dossier** (comme dans la vidéo) : `reveal-ohmygab/`, `hero-driveby/`... pour éviter que l'IA mélange les fichiers.
2. **Itère en prompts courts** après le premier rendu : "rends les cartes 15% plus petites", "ralentis le marquee", "remplace les placeholders par ces URLs : ...".
3. **Remplace les polices Google Fonts** si tu as une charte existante — précise simplement "use [font] instead, keep everything else".
4. **Images** : génère tes assets d'abord (Higgsfield/GPT Image), récupère les URLs, injecte-les dans les prompts (champs `[URL_...]`).
5. **Pour la viralité X** : enregistre l'écran en interagissant (scroll + hover), poste en vidéo, jamais en image statique.
