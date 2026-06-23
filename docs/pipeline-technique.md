# Pipeline technique — frames, scroll & effets cinématiques

Code de référence pour l'assemblage du site en Claude Code. Tout est HTML/CSS/JS standard, librairies via CDN (jsdelivr/cdnjs). Adapter chemins, comptes de frames et valeurs.

---

## 1. Télécharger le clip Higgsfield

Une fois le clip rendu (job Higgsfield), récupérer son URL et le télécharger :
```bash
mkdir -p assets/clips assets/frames
curl -L "<URL_DU_CLIP_HIGGSFIELD>" -o assets/clips/hero.mp4
```

## 2. Extraire les frames (ffmpeg)

```bash
# 30 fps, largeur 1920 (hauteur auto), JPG qualité web
ffmpeg -i assets/clips/hero.mp4 -vf "fps=30,scale=1920:-1:flags=lanczos" \
  -q:v 4 assets/frames/hero_%04d.jpg

# Compter les frames produites (utile pour frameCount côté JS)
ls assets/frames/hero_*.jpg | wc -l
```
Conseils : viser **80–150 frames** pour une séquence scroll fluide sans alourdir. Pour le web moderne, `.webp` réduit le poids :
```bash
ffmpeg -i assets/clips/hero.mp4 -vf "fps=30,scale=1600:-1" assets/frames/hero_%04d.webp
```

## 3. Optimiser (optionnel mais recommandé)

```bash
# Redimensionner / compresser en lot si trop lourd
for f in assets/frames/hero_*.jpg; do
  ffmpeg -i "$f" -vf "scale=1600:-1" -q:v 5 "${f%.jpg}_opt.jpg" -y
done
```
Cible : chaque frame < 150 Ko, séquence totale < 15–20 Mo idéalement (lazy-load possible).

---

## 4. Séquence frame-au-scroll (technique "Apple")

`<canvas>` piloté par la progression de scroll. Charger GSAP + ScrollTrigger via CDN.

**HTML**
```html
<section class="sequence">
  <canvas id="hero-seq"></canvas>
</section>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
```

**JS**
```js
gsap.registerPlugin(ScrollTrigger);

const canvas = document.getElementById("hero-seq");
const ctx = canvas.getContext("2d");
const frameCount = 120;                 // ← nombre réel de frames
const frameSrc = i => `assets/frames/hero_${String(i + 1).padStart(4, "0")}.jpg`;

canvas.width = 1600; canvas.height = 900; // ratio de tes frames

const images = [];
let loaded = 0;
const seq = { frame: 0 };

for (let i = 0; i < frameCount; i++) {
  const img = new Image();
  img.onload = () => { if (++loaded === 1) render(); };
  img.src = frameSrc(i);
  images.push(img);
}

function render() {
  const img = images[seq.frame];
  if (img && img.complete) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
}

gsap.to(seq, {
  frame: frameCount - 1,
  snap: "frame",
  ease: "none",
  scrollTrigger: {
    trigger: ".sequence",
    start: "top top",
    end: "+=3000",        // longueur de scroll dédiée à la séquence
    scrub: 0.5,            // lissage (scroll pacing)
    pin: true             // épingle la section pendant la lecture
  },
  onUpdate: render
});
```

**CSS**
```css
.sequence { height: 100vh; }
#hero-seq { width: 100%; height: 100vh; object-fit: cover; display: block; }
```

> Alternative légère sans canvas : un `<video>` `muted playsinline` dont on pilote `currentTime` via ScrollTrigger (`onUpdate: () => video.currentTime = progress * video.duration`). Moins fluide sur certains navigateurs mobiles que la séquence d'images.

---

## 5. Scroll fluide — Lenis (synchronisé GSAP)

```html
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js"></script>
```
```js
const lenis = new Lenis({
  duration: 1.2,                                   // scroll pacing
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true
});
function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

// Synchroniser Lenis ↔ ScrollTrigger
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

## 6. Reveals de sections au scroll

```js
gsap.utils.toArray(".reveal").forEach(el => {
  gsap.from(el, {
    y: 40, opacity: 0, duration: 0.9, ease: "power3.out",
    scrollTrigger: { trigger: el, start: "top 80%" }
  });
});
```

---

## Les 6 effets cinématiques (code)

### 1. Film grain
```css
.grain::after{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:9999;
  opacity:.06; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
/* grain animé : @keyframes qui translate le background de quelques px */
```

### 2. Particules (canvas léger)
```js
const pc = document.getElementById("particles");
const pctx = pc.getContext("2d");
function sizeP(){ pc.width = innerWidth; pc.height = innerHeight; }
sizeP(); addEventListener("resize", sizeP);
const parts = Array.from({length: 60}, () => ({
  x: Math.random()*pc.width, y: Math.random()*pc.height,
  r: Math.random()*1.8+.3, vy: Math.random()*.3+.05, a: Math.random()*.5+.2
}));
(function loop(){
  pctx.clearRect(0,0,pc.width,pc.height);
  parts.forEach(p=>{
    p.y -= p.vy; if(p.y < -5){ p.y = pc.height+5; p.x = Math.random()*pc.width; }
    pctx.beginPath(); pctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    pctx.fillStyle = `rgba(255,255,255,${p.a})`; pctx.fill();
  });
  requestAnimationFrame(loop);
})();
```
```css
#particles{position:fixed; inset:0; pointer-events:none; z-index:5;}
```

### 3. Vignette
```css
.vignette::before{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:6;
  background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%);
}
```

### 4. Glass cards
```css
.glass{
  background:rgba(255,255,255,.06);
  backdrop-filter:blur(14px) saturate(120%);
  -webkit-backdrop-filter:blur(14px) saturate(120%);
  border:1px solid rgba(255,255,255,.12);
  border-radius:18px; box-shadow:0 8px 40px rgba(0,0,0,.35);
}
```

### 5. Color tints (teinte qui évolue au scroll)
```css
.tint{position:fixed; inset:0; pointer-events:none; z-index:4; mix-blend-mode:soft-light;
  background:linear-gradient(180deg, var(--tint-a), var(--tint-b)); transition:background .6s;}
```
```js
// changer les variables --tint-a/--tint-b par section au scroll
ScrollTrigger.create({
  trigger:".section-2", start:"top center",
  onEnter:()=>document.documentElement.style.setProperty("--tint-a","#0a1f3c"),
  onLeaveBack:()=>document.documentElement.style.setProperty("--tint-a","#1a0a2c")
});
```

### 6. Scroll pacing
Réglé via Lenis (`duration`, `easing`) + GSAP (`scrub`, `snap`). Pour un snap par section :
```js
ScrollTrigger.create({
  snap:{ snapTo:1/(sectionsCount-1), duration:0.4, ease:"power2.inOut" }
});
```

---

## Accessibilité (quality floor)
```css
@media (prefers-reduced-motion: reduce){
  *{animation:none!important; scroll-behavior:auto!important;}
}
```
Désactiver aussi Lenis et les particules si `matchMedia("(prefers-reduced-motion: reduce)").matches`. Garder un focus clavier visible (`:focus-visible`) et un fallback statique (poster du hero) si JS échoue.

---

## Ordre des z-index (repère)
| Couche | z-index |
|---|---|
| Contenu / sections | 1–3 |
| Color tint | 4 |
| Particules | 5 |
| Vignette | 6 |
| Glass cards | (dans le flux, au-dessus du fond local) |
| Film grain | 9999 |
