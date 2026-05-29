// Hosts whose CDN refuses cross-origin requests (hotlinking protection on
// Referer). We route them through our server-side proxy at /api/img-proxy.
const PROXIED_HOSTS = ['alicdn.com', 'alibaba.com', '1688.com', 'taobao.com'];

export function needsProxy(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROXIED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

/**
 * Returns the original URL untouched unless it points to a CDN known to block
 * cross-origin requests; in that case, returns our server-side proxy URL.
 */
export function proxyImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  if (!needsProxy(url)) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

/** Same logic, but tolerates already-proxied URLs (no double-encoding). */
export function ensureProxied(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('/api/img-proxy?')) return url;
  return proxyImageUrl(url);
}
