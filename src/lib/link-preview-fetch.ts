// Récupération d'un aperçu de lien côté serveur. Protection SSRF : http(s)
// seulement, chaque hôte (redirections comprises) résolu et refusé s'il pointe
// vers une adresse privée ; 4 redirections, 6 s et 600 Ko au plus. Résultats
// gardés 12 h en mémoire (échecs 10 min) : la messagerie redemande souvent
// les mêmes liens (catalogues, paniers).

import { lookup } from 'dns/promises';
import { isFetchableUrl, isPrivateAddress, parseOpenGraph, type LinkPreview } from '@/lib/link-preview';

const CACHE = new Map<string, { at: number; ttl: number; value: LinkPreview | null }>();
const OK_TTL = 12 * 3600_000;
const FAIL_TTL = 10 * 60_000;
const MAX_BYTES = 600_000;

async function hostIsPublic(hostname: string): Promise<boolean> {
  try {
    const addrs = await lookup(hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => undefined);
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  const cached = CACHE.get(rawUrl);
  if (cached && Date.now() - cached.at < cached.ttl) return cached.value;

  let value: LinkPreview | null = null;
  try {
    let url = rawUrl;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      for (let hop = 0; hop <= 4; hop++) {
        if (!isFetchableUrl(url) || !(await hostIsPublic(new URL(url).hostname))) break;
        const res = await fetch(url, {
          redirect: 'manual',
          signal: controller.signal,
          // Beaucoup de sites (dont les raccourcisseurs) servent leurs balises de partage aux robots d'aperçu.
          headers: { 'User-Agent': 'WhatsApp/2.23.20 (TwinskLinkPreview)', Accept: 'text/html,application/xhtml+xml' },
        });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) break;
          url = new URL(loc, url).toString();
          continue;
        }
        if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) break;
        value = parseOpenGraph(await readCapped(res), url);
        value.url = rawUrl;
        break;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    value = null;
  }
  if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(rawUrl, { at: Date.now(), ttl: value ? OK_TTL : FAIL_TTL, value });
  return value;
}
