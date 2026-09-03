import type { NextRequest } from 'next/server';

/** Domaine public de l'app quand rien ne permet de le déduire (cron interne, tests). */
export const PUBLIC_ORIGIN_FALLBACK = 'https://twinsk-production.up.railway.app';

/**
 * Origine PUBLIQUE d'une requête. Derrière le proxy Railway, `request.nextUrl.origin`
 * vaut l'adresse d'écoute du conteneur (`https://0.0.0.0:8080`) — inutilisable
 * dans un lien envoyé à un client. On lit les en-têtes du proxy, puis on retombe
 * sur le domaine de production.
 */
export function publicOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host || /^(0\.0\.0\.0|127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return PUBLIC_ORIGIN_FALLBACK;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto.split(',')[0].trim()}://${host}`;
}
