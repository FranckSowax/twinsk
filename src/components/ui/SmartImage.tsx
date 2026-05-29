'use client';

import { useState, useEffect } from 'react';
import { proxyImageUrl } from '@/lib/utils/imageProxy';

interface SmartImageProps {
  src: string;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
}

/**
 * Image component with automatic fallback to a secondary URL on error.
 * Routes hotlinking-protected CDNs (Alibaba/1688/Taobao) through the
 * /api/img-proxy server route so the browser-side Referer doesn't get
 * the request rejected.
 */
export default function SmartImage({ src, fallbackSrc, alt, className }: SmartImageProps) {
  const initial = proxyImageUrl(src) || proxyImageUrl(fallbackSrc || '');
  const [currentSrc, setCurrentSrc] = useState(initial);
  const [erroredOnce, setErroredOnce] = useState(false);

  // Reset when src changes
  useEffect(() => {
    setCurrentSrc(proxyImageUrl(src) || proxyImageUrl(fallbackSrc || ''));
    setErroredOnce(false);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (!erroredOnce && fallbackSrc) {
      const fb = proxyImageUrl(fallbackSrc);
      if (fb && fb !== currentSrc) {
        setErroredOnce(true);
        setCurrentSrc(fb);
      }
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
