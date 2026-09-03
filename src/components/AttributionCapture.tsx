'use client';

import { useEffect } from 'react';
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_DAYS,
  deserializeAttribution,
  mergeAttribution,
  parseTouchPoint,
  serializeAttribution,
} from '@/lib/attribution';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : null;
}

/**
 * Enregistre la provenance du visiteur dans un cookie lisible côté serveur.
 * Monté une fois dans le layout racine : couvre toutes les pages du funnel
 * (/offer, /quote, /request, /freight…) sans toucher aux formulaires.
 *
 * Cookie volontairement non-httpOnly : posé par le navigateur, relu par les
 * routes API. Il ne contient aucune donnée personnelle, seulement la campagne.
 */
export default function AttributionCapture() {
  useEffect(() => {
    // Un referrer interne n'apprend rien sur l'origine : on l'ignore.
    let referrer: string | undefined;
    try {
      if (document.referrer && new URL(document.referrer).origin !== window.location.origin) {
        referrer = document.referrer;
      }
    } catch {
      referrer = undefined;
    }

    const touch = parseTouchPoint(window.location.search, {
      referrer,
      path: window.location.pathname,
    });
    if (!touch) return; // visite directe : on préserve l'attribution existante

    const existing = deserializeAttribution(readCookie(ATTRIBUTION_COOKIE));
    const value = serializeAttribution(mergeAttribution(existing, touch));
    const maxAge = ATTRIBUTION_MAX_AGE_DAYS * 24 * 60 * 60;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${ATTRIBUTION_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  }, []);

  return null;
}
