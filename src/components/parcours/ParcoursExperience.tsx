'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SCENES, type Scene } from './scenes';
import styles from './parcours.module.css';

const WHATSAPP_URL = 'https://wa.me/24100000000?text=Bonjour%20TWINSK%2C%20je%20veux%20faire%20venir%20un%20colis%20de%20Chine';

/** Dessine une image en mode "cover" (remplit le canvas sans déformation). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const cr = w / h;
  let dw: number;
  let dh: number;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
  } else {
    dw = w;
    dh = w / ir;
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Placeholder animé : un colis qui traverse la scène, pour visualiser la mécanique scroll. */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  progress: number,
  w: number,
  h: number,
) {
  // Fond dégradé d'ambiance
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, scene.gradient[0]);
  grad.addColorStop(1, scene.gradient[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Ligne de sol
  const ground = h * 0.66;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ground);
  ctx.lineTo(w, ground);
  ctx.stroke();

  // Colis (élément signature) qui traverse de gauche à droite
  const size = Math.min(w, h) * 0.14;
  const x = w * (0.12 + progress * 0.76);
  const bob = Math.sin(progress * Math.PI * 4) * size * 0.05;
  const y = ground - size - bob;

  // Ombre
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + size / 2, ground + 6, size * 0.55, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Corps du colis
  ctx.fillStyle = scene.accent;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, size * 0.08);
  ctx.fill();
  // Bande adhésive
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x, y + size * 0.42, size, size * 0.16);
  ctx.fillRect(x + size * 0.42, y, size * 0.16, size);

  // Étiquette / repère placeholder
  ctx.fillStyle = 'rgba(245,241,232,0.5)';
  ctx.font = `600 ${Math.max(12, w * 0.012)}px system-ui, sans-serif`;
  ctx.fillText(`${scene.index} · ${scene.kicker} · placeholder`, 28, 44);
}

export default function ParcoursExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // --- Lenis (smooth scroll) synchronisé à ScrollTrigger ---
      let lenis: Lenis | null = null;
      if (!reduceMotion) {
        lenis = new Lenis({
          duration: 1.15,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
        });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis!.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
      }

      // --- Par scène : canvas frame-au-scroll + caption + color tint ---
      const renderers: (() => void)[] = [];

      SCENES.forEach((scene, i) => {
        const section = sceneRefs.current[i];
        const canvas = canvasRefs.current[i];
        const caption = captionRefs.current[i];
        if (!section || !canvas) return;

        const c2d = canvas.getContext('2d');
        if (!c2d) return;

        // Frames réelles : chargées en lazy (cf. loadImages) pour alléger le 1er rendu.
        const images: HTMLImageElement[] = [];
        const state = { progress: 0 };
        let imagesRequested = false;

        const loadImages = () => {
          if (imagesRequested || !scene.framesReady || scene.frameCount === 0) return;
          imagesRequested = true;
          for (let f = 0; f < scene.frameCount; f++) {
            const img = new Image();
            // Le premier chargement déclenche un re-render (affiche la frame dès qu'elle arrive)
            img.onload = () => render();
            img.src = `/parcours/frames/${scene.framePrefix}_${String(f + 1).padStart(4, '0')}.jpg`;
            images.push(img);
          }
        };

        const sizeCanvas = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const render = () => {
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          if (scene.framesReady && scene.frameCount > 0) {
            const idx = Math.min(
              scene.frameCount - 1,
              Math.round(state.progress * (scene.frameCount - 1)),
            );
            const img = images[idx];
            c2d.clearRect(0, 0, w, h);
            if (img && img.complete && img.naturalWidth) {
              drawCover(c2d, img, w, h);
            } else {
              drawPlaceholder(c2d, scene, state.progress, w, h);
            }
          } else {
            drawPlaceholder(c2d, scene, state.progress, w, h);
          }
        };

        sizeCanvas();
        render();
        renderers.push(() => {
          sizeCanvas();
          render();
        });

        // Lazy-load : la 1re scène charge tout de suite, les autres à l'approche du viewport.
        if (i === 0) {
          loadImages();
        } else {
          ScrollTrigger.create({
            trigger: section,
            start: 'top bottom', // dès que la scène pointe en bas de l'écran (≈1.3 écran d'avance)
            once: true,
            onEnter: loadImages,
          });
        }

        if (reduceMotion) {
          // Fallback statique : frame du milieu, caption visible
          loadImages();
          state.progress = 0.5;
          render();
          if (caption) gsap.set(caption, { opacity: 1, y: 0 });
          return;
        }

        // Scrub : progression de la section -> frame
        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.5,
          onUpdate: (self) => {
            state.progress = self.progress;
            render();
            // Caption : apparaît tôt, disparaît tard
            if (caption) {
              const p = self.progress;
              const o = Math.min(1, p / 0.12) * Math.min(1, (1 - p) / 0.15);
              caption.style.opacity = String(Math.max(0, o));
              caption.style.transform = `translateY(${(1 - Math.min(1, p / 0.12)) * 30}px)`;
            }
          },
        });

        // Color tint : applique la teinte de la scène quand elle entre à l'écran
        ScrollTrigger.create({
          trigger: section,
          start: 'top 60%',
          end: 'bottom 40%',
          onEnter: () => gsap.to(rootRef.current!, { '--tint': scene.tint, duration: 0.8 } as gsap.TweenVars),
          onEnterBack: () => gsap.to(rootRef.current!, { '--tint': scene.tint, duration: 0.8 } as gsap.TweenVars),
        });
      });

      // Barre de progression globale
      if (progressRef.current) {
        gsap.to(progressRef.current, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
        });
      }

      // Resize : recalcule tous les canvas
      const onResize = () => {
        renderers.forEach((r) => r());
        ScrollTrigger.refresh();
      };
      window.addEventListener('resize', onResize);

      // Cleanup local au context
      return () => {
        window.removeEventListener('resize', onResize);
        lenis?.destroy();
      };
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // Initialise la teinte de la 1re scène
  const rootStyle = { '--tint': SCENES[0].tint } as React.CSSProperties;

  return (
    <div ref={rootRef} className={`${styles.root} ${styles.grain}`} style={rootStyle}>
      <div className={styles.tintLayer} aria-hidden />
      <div ref={progressRef} className={styles.progress} aria-hidden />

      {/* Intro */}
      <section className={styles.intro}>
        <p className={styles.introBrand}>TWINSK · Sourcing & Logistique Chine → Afrique</p>
        <h1 className={styles.introTitle}>Le voyage d’un colis, de la Chine à vos mains.</h1>
        <p className={styles.introSub}>
          Suivez un colis TWINSK à chaque étape — de l’usine chinoise jusqu’à la livraison à Libreville.
        </p>
        <p className={styles.scrollHint}>Défilez pour suivre ↓</p>
      </section>

      {/* Les 6 actes */}
      {SCENES.map((scene, i) => (
        <section
          key={scene.id}
          ref={(el) => { sceneRefs.current[i] = el; }}
          className={styles.scene}
          aria-label={`${scene.index} — ${scene.kicker}`}
        >
          <div className={styles.sticky}>
            <canvas
              ref={(el) => { canvasRefs.current[i] = el; }}
              className={styles.canvas}
              aria-hidden
            />
            <div
              ref={(el) => { captionRefs.current[i] = el; }}
              className={styles.caption}
              style={{ '--accent': scene.accent } as React.CSSProperties}
            >
              <p className={styles.captionIndex}>{scene.index}</p>
              <p className={styles.captionKicker}>{scene.kicker}</p>
              <h2 className={styles.captionTitle}>{scene.title}</h2>
              <p className={styles.captionBody}>{scene.body}</p>
            </div>
          </div>
        </section>
      ))}

      {/* Outro / CTA */}
      <section className={styles.outro}>
        <h2 className={styles.outroTitle}>Votre prochain colis commence ici.</h2>
        <p className={styles.outroSub}>
          Sourcing, contrôle qualité, consolidation et livraison jusqu’au Gabon. TWINSK gère tout le trajet.
        </p>
        <a className={styles.cta} href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          Commander sur WhatsApp
        </a>
        <p className={styles.ctaSecondary}>
          <a href="/">← Retour à l’accueil TWINSK</a>
        </p>
      </section>
    </div>
  );
}
