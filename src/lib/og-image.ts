// Construction de l'image d'aperçu (Open Graph) pour les pages publiques.
//
// Deux pièges que ce module corrige :
//  1. Sans og:image:width/height, Facebook ne connaît pas la taille au moment
//     où il lit la page : il met l'image en file d'attente et affiche la carte
//     SANS visuel. C'est la cause n°1 des aperçus gris.
//  2. Les CDN chinois (alicdn/1688/taobao) refusent le hotlinking : le crawler
//     de Facebook se fait jeter comme n'importe quel client externe. Ces images
//     doivent passer par notre proxy, en URL ABSOLUE (og:image n'accepte pas
//     de chemin relatif).

import { needsProxy } from '@/lib/utils/imageProxy';

export interface OgImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

/** Taille d'en-tête suffisante pour lire les dimensions des formats courants. */
const HEADER_BYTES = 65536;

/** Cache Next : les covers ne changent quasiment jamais. */
const REVALIDATE_SECONDS = 86400;

export interface ImageSize {
  width: number;
  height: number;
}

/** PNG : signature 8 octets, puis IHDR — largeur/hauteur en big-endian à l'offset 16. */
function parsePng(b: Buffer): ImageSize | null {
  if (b.length < 24) return null;
  if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

/** GIF : « GIF87a »/« GIF89a », dimensions en little-endian à l'offset 6. */
function parseGif(b: Buffer): ImageSize | null {
  if (b.length < 10) return null;
  if (b.toString('ascii', 0, 3) !== 'GIF') return null;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

/**
 * JPEG : on parcourt les marqueurs jusqu'au segment SOF (Start Of Frame),
 * qui porte les dimensions. Les marqueurs C4/C8/CC ne sont PAS des SOF.
 */
function parseJpeg(b: Buffer): ImageSize | null {
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset++; // resynchronisation sur du remplissage
      continue;
    }
    const marker = b[offset + 1];
    if (marker === 0xff) {
      offset++;
      continue;
    }
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      return { height: b.readUInt16BE(offset + 5), width: b.readUInt16BE(offset + 7) };
    }
    const segmentLength = b.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null; // segment corrompu
    offset += 2 + segmentLength;
  }
  return null;
}

/** WebP : trois variantes de chunk (lossy VP8, lossless VP8L, étendu VP8X). */
function parseWebp(b: Buffer): ImageSize | null {
  if (b.length < 30) return null;
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);

  if (chunk === 'VP8 ') {
    if (b.readUInt16BE(23) !== 0x9d01 || b[25] !== 0x2a) return null; // start code
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null; // signature lossless
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    const w = b[24] | (b[25] << 8) | (b[26] << 16);
    const h = b[27] | (b[28] << 8) | (b[29] << 16);
    return { width: w + 1, height: h + 1 };
  }
  return null;
}

/** Lit les dimensions depuis l'en-tête binaire. null si format non reconnu. */
export function parseImageSize(bytes: Buffer): ImageSize | null {
  const size =
    parsePng(bytes) ?? parseGif(bytes) ?? parseWebp(bytes) ?? parseJpeg(bytes);
  if (!size) return null;
  // Une dimension nulle ou absurde vaut mieux ne pas être déclarée du tout.
  if (!size.width || !size.height || size.width > 20000 || size.height > 20000) return null;
  return size;
}

/**
 * Télécharge le début du fichier et en extrait les dimensions.
 * Best-effort : toute erreur renvoie null, l'aperçu reste fonctionnel sans
 * width/height (juste moins fiable côté Facebook).
 */
export async function fetchImageSize(url: string): Promise<ImageSize | null> {
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return parseImageSize(bytes);
  } catch {
    return null;
  }
}

/**
 * Rend une URL d'image absolue et lui applique le proxy si son CDN bloque le
 * hotlinking — sans quoi le crawler de Facebook ne peut pas la télécharger.
 */
export function toAbsoluteOgUrl(url: string, origin: string): string {
  if (needsProxy(url)) {
    return `${origin}/api/img-proxy?url=${encodeURIComponent(url)}`;
  }
  if (url.startsWith('/api/img-proxy?')) return `${origin}${url}`;
  if (url.startsWith('/')) return `${origin}${url}`;
  return url;
}

/**
 * Construit l'entrée `images` d'Open Graph : URL absolue, proxifiée au besoin,
 * dimensions mesurées. Retourne null si aucune image n'est disponible.
 */
export async function buildOgImage(
  rawUrl: string | null | undefined,
  origin: string,
  alt?: string,
): Promise<OgImage | null> {
  if (!rawUrl) return null;
  const url = toAbsoluteOgUrl(rawUrl, origin);
  const size = await fetchImageSize(url);
  return { url, ...(size ?? {}), ...(alt ? { alt } : {}) };
}
