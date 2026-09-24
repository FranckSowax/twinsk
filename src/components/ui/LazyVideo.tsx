'use client';

// Vidéo muette en boucle qui ne se télécharge QUE lorsqu'elle est réellement
// visible à l'écran. Pourquoi : un <video autoPlay src=…> commence à se
// télécharger dès l'ouverture de la page, même hors écran ou masqué par CSS
// (vidéo « mobile » cachée sur ordinateur et inversement). Sur /bio (jusqu'à
// 16 vignettes) et sur les listings, c'est ce qui a épuisé la bande passante
// Supabase du Gabon le 24 septembre 2026.
//
// Règles :
//  - aucune source tant que l'élément n'a jamais été visible (preload="none") ;
//  - un élément masqué par CSS (display:none) n'est jamais « visible » pour
//    IntersectionObserver : il ne se charge donc jamais ;
//  - lecture quand visible, pause sinon ; la source reste une fois chargée
//    (pas de nouveau téléchargement en revenant sur la vignette) ;
//  - navigateur sans IntersectionObserver : la vidéo ne se charge pas, l'image
//    `poster` reste affichée.

import { useEffect, useRef, useState, type VideoHTMLAttributes } from 'react';

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'autoPlay' | 'preload'> & {
  src: string;
  /** Marge d'anticipation du chargement (défaut : 200px avant d'entrer à l'écran). */
  rootMargin?: string;
};

export default function LazyVideo({ src, rootMargin = '200px 0px', muted = true, loop = true, playsInline = true, ...rest }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);

  // 1. Active la source à la première apparition (avec marge d'anticipation).
  useEffect(() => {
    const v = ref.current;
    if (!v || activated || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActivated(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [activated, rootMargin]);

  // 2. Lecture seulement quand au moins un quart de la vidéo est à l'écran.
  useEffect(() => {
    const v = ref.current;
    if (!v || !activated || typeof IntersectionObserver === 'undefined') return;
    // React ne pose pas `muted` dans le HTML : iOS / Chrome refusent sinon la lecture automatique.
    v.muted = muted;
    v.defaultMuted = muted;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last.isIntersecting) v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [activated, muted]);

  return (
    <video
      ref={ref}
      src={activated ? src : undefined}
      preload={activated ? 'auto' : 'none'}
      muted={muted}
      loop={loop}
      playsInline={playsInline}
      {...rest}
    />
  );
}
