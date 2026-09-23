// Aperçu de lien (image de partage, titre, description) comme WhatsApp :
// lecture des balises Open Graph d'une page. Module pur (parseur + garde
// réseau) ; la récupération elle-même est dans link-preview-fetch.ts.

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Balises <meta> d'un document : { "og:title": "…", "description": "…" } (clé en minuscules). */
function metaTags(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = (name: string) => {
      const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
      return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
    };
    const key = (attr('property') || attr('name') || '').toLowerCase();
    const content = attr('content');
    if (key && content != null && !out.has(key)) out.set(key, decodeEntities(content).trim());
  }
  return out;
}

/** Aperçu tiré du HTML d'une page ; les adresses relatives sont résolues depuis `pageUrl`. */
export function parseOpenGraph(html: string, pageUrl: string): LinkPreview {
  const head = html.slice(0, 300_000);
  const meta = metaTags(head);
  const pick = (...keys: string[]) => keys.map((k) => meta.get(k)).find((v) => v && v.length > 0) || null;
  const titleTag = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const abs = (u: string | null) => {
    if (!u) return null;
    try {
      const r = new URL(u, pageUrl);
      return r.protocol === 'http:' || r.protocol === 'https:' ? r.toString() : null;
    } catch {
      return null;
    }
  };
  const clip = (s: string | null, n: number) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null);
  return {
    url: pageUrl,
    title: clip(pick('og:title', 'twitter:title') || (titleTag ? decodeEntities(titleTag).trim() : null), 200),
    description: clip(pick('og:description', 'twitter:description', 'description'), 300),
    image: abs(pick('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src')),
    site: clip(pick('og:site_name'), 80),
  };
}

/** Adresse IP privée, locale ou réservée : jamais contactée par le serveur (protection SSRF). */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (v.includes(':')) {
    if (v === '::' || v === '::1') return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(v);
  }
  const p = v.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** Adresse acceptable pour un aperçu : http(s), port standard, pas d'hôte local. */
export function isFetchableUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.port && u.port !== '80' && u.port !== '443') return false;
    if (u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    return !!h && h.includes('.') && h !== 'localhost' && !h.endsWith('.local') && !h.endsWith('.internal');
  } catch {
    return false;
  }
}
