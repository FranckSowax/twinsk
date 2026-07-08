'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SmartImage from './SmartImage';
import { VideoEmbed } from './VideoEmbed';

interface ImageGalleryProps {
  images: string[];
  /** Vidéos placées EN TÊTE de la galerie (avant les photos). */
  videos?: string[];
  alt: string;
  className?: string;
}

type Media = { type: 'video' | 'image'; url: string };

/** Galerie média (vidéos en tête + images) avec flèches, miniatures, clavier. */
export default function ImageGallery({ images, videos = [], alt, className = '' }: ImageGalleryProps) {
  const media: Media[] = [
    ...Array.from(new Set(videos.filter(Boolean))).map((url) => ({ type: 'video' as const, url })),
    ...Array.from(new Set(images.filter(Boolean))).map((url) => ({ type: 'image' as const, url })),
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + media.length) % media.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % media.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.length]);

  if (!media.length) return null;

  const safeIndex = Math.min(index, media.length - 1);
  const cur = media[safeIndex];
  const hasMultiple = media.length > 1;
  const prev = () => setIndex((i) => (i - 1 + media.length) % media.length);
  const next = () => setIndex((i) => (i + 1) % media.length);

  return (
    <div className={className}>
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-900 sm:aspect-[16/10]">
        <AnimatePresence mode="wait">
          <motion.div
            key={safeIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {cur.type === 'video' ? (
              <div className="flex h-full w-full items-center justify-center bg-black p-2">
                <VideoEmbed url={cur.url} className="w-full" />
              </div>
            ) : (
              <SmartImage
                src={cur.url}
                fallbackSrc={media.find((m) => m.type === 'image')?.url || cur.url}
                alt={`${alt} — ${safeIndex + 1}`}
                className="h-full w-full object-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Média précédent"
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-700/90 dark:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Média suivant"
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-700/90 dark:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
              {safeIndex + 1} / {media.length}
            </div>
          </>
        )}
      </div>

      {/* Miniatures */}
      {hasMultiple && (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {media.map((m, i) => (
            <button
              type="button"
              key={`${m.type}-${i}`}
              onClick={() => setIndex(i)}
              className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                i === safeIndex ? 'border-amber-500 shadow' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {m.type === 'video' ? (
                <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white">
                  <Play className="h-5 w-5" />
                </div>
              ) : (
                <SmartImage src={m.url} alt={`Miniature ${i + 1}`} className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
