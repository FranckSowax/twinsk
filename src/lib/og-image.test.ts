import { describe, expect, it } from 'vitest';
import { parseImageSize, toAbsoluteOgUrl } from './og-image';

/** PNG minimal : signature + IHDR portant les dimensions. */
function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

/** JPEG : SOI, un segment APP0 à sauter, puis SOF0 (hauteur avant largeur). */
function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.alloc(20);
  app0.writeUInt16BE(0xffe0, 0);
  app0.writeUInt16BE(18, 2); // longueur du segment
  const sof = Buffer.alloc(11);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(9, 2);
  sof.writeUInt8(8, 4); // précision
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

function gif(width: number, height: number): Buffer {
  const b = Buffer.alloc(10);
  b.write('GIF89a', 0, 'ascii');
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return b;
}

/** WebP étendu (VP8X) : dimensions sur 3 octets little-endian, moins 1. */
function webpVp8x(width: number, height: number): Buffer {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  const w = width - 1;
  const h = height - 1;
  b[24] = w & 0xff;
  b[25] = (w >> 8) & 0xff;
  b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff;
  b[28] = (h >> 8) & 0xff;
  b[29] = (h >> 16) & 0xff;
  return b;
}

describe('parseImageSize', () => {
  it('lit un PNG', () => {
    expect(parseImageSize(png(1088, 608))).toEqual({ width: 1088, height: 608 });
  });

  it('lit un JPEG en sautant les segments intermédiaires', () => {
    expect(parseImageSize(jpeg(1200, 630))).toEqual({ width: 1200, height: 630 });
  });

  it('lit un GIF', () => {
    expect(parseImageSize(gif(800, 400))).toEqual({ width: 800, height: 400 });
  });

  it('lit un WebP étendu', () => {
    expect(parseImageSize(webpVp8x(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it('renvoie null sur un format inconnu ou un buffer tronqué', () => {
    expect(parseImageSize(Buffer.from('pas une image'))).toBeNull();
    expect(parseImageSize(Buffer.alloc(0))).toBeNull();
    expect(parseImageSize(png(1088, 608).subarray(0, 12))).toBeNull();
  });

  it('rejette des dimensions nulles ou absurdes plutôt que de les déclarer', () => {
    expect(parseImageSize(png(0, 600))).toBeNull();
    expect(parseImageSize(png(999999, 600))).toBeNull();
  });
});

describe('toAbsoluteOgUrl', () => {
  const origin = 'https://twinsk-production.up.railway.app';

  it('laisse intacte une URL déjà absolue et non bloquée', () => {
    const url = 'https://qaemzzpyrmoopfkiciki.supabase.co/storage/v1/object/public/x.png';
    expect(toAbsoluteOgUrl(url, origin)).toBe(url);
  });

  it('proxifie les CDN chinois qui refusent le hotlinking', () => {
    const url = 'https://cbu01.alicdn.com/img/ibank/photo.jpg';
    expect(toAbsoluteOgUrl(url, origin)).toBe(
      `${origin}/api/img-proxy?url=${encodeURIComponent(url)}`,
    );
  });

  it('rend absolue une URL déjà proxifiée sans la ré-encoder', () => {
    const already = '/api/img-proxy?url=https%3A%2F%2Fcbu01.alicdn.com%2Fx.jpg';
    expect(toAbsoluteOgUrl(already, origin)).toBe(`${origin}${already}`);
  });

  it('rend absolu un chemin relatif', () => {
    expect(toAbsoluteOgUrl('/cover.png', origin)).toBe(`${origin}/cover.png`);
  });
});
