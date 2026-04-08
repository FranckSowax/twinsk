'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SmartImage from './SmartImage';

interface ImageGalleryProps {
  images: string[];
  alt: string;
  className?: string;
}

/** Image gallery with navigation arrows, thumbnail strip, and swipe/keyboard support. */
export default function ImageGallery({ images, alt, className = '' }: ImageGalleryProps) {
  const [index, setIndex] = useState(0);
  const uniqueImages = Array.from(new Set(images.filter(Boolean)));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueImages.length]);

  if (!uniqueImages.length) return null;

  const prev = () => setIndex((i) => (i - 1 + uniqueImages.length) % uniqueImages.length);
  const next = () => setIndex((i) => (i + 1) % uniqueImages.length);

  const hasMultiple = uniqueImages.length > 1;

  return (
    <div className={className}>
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-900 sm:aspect-[16/10]">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            <SmartImage
              src={uniqueImages[index]}
              fallbackSrc={uniqueImages[0]}
              alt={`${alt} — ${index + 1}`}
              className="h-full w-full object-contain"
            />
          </motion.div>
        </AnimatePresence>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Image précédente"
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-700/90 dark:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Image suivante"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-700/90 dark:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
              {index + 1} / {uniqueImages.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {hasMultiple && (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {uniqueImages.map((img, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setIndex(i)}
              className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                i === index
                  ? 'border-amber-500 shadow'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <SmartImage src={img} alt={`Miniature ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
