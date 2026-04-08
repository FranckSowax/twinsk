'use client';

import { useState, useEffect } from 'react';

interface SmartImageProps {
  src: string;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
}

/**
 * Image component with automatic fallback to a secondary URL on error.
 * Used when main_image_url sometimes comes from a different CDN that fails,
 * while the thumbnail image_url still works.
 */
export default function SmartImage({ src, fallbackSrc, alt, className }: SmartImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc || '');
  const [erroredOnce, setErroredOnce] = useState(false);

  // Reset when src changes
  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || '');
    setErroredOnce(false);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (!erroredOnce && fallbackSrc && fallbackSrc !== currentSrc) {
      setErroredOnce(true);
      setCurrentSrc(fallbackSrc);
    }
  };

  if (!currentSrc) {
    return <div className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={currentSrc} alt={alt} className={className} onError={handleError} />
  );
}
