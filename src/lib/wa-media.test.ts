import { describe, expect, it } from 'vitest';
import { buildMediaPlan, campaignMedia, mediaKindFromUrl, normalizeMediaLibrary } from './wa-media';
import { isMediaHour, normalizeDripConfig, normalizeMediaHours } from './wa-drip';

const lib = normalizeMediaLibrary([
  { id: 'a', url: 'https://cdn/x/a.mp4', title: 'Vidéo A', caption: 'Nouveautés !' },
  { id: 'b', url: 'https://cdn/x/b.jpg', kind: 'image', caption: '', active: false },
  { id: 'c', url: 'https://cdn/x/c.png', caption: 'Photo C' },
  { id: 'c', url: 'https://cdn/x/dup.png' }, // doublon d'id ignoré
  { id: 'd', url: 'pas-une-url' }, // invalide
]);

describe('médiathèque de diffusion', () => {
  it('normalise, déduit le type et ignore les entrées invalides ou en double', () => {
    expect(lib.map((m) => [m.id, m.kind, m.active])).toEqual([
      ['a', 'video', true],
      ['b', 'image', false],
      ['c', 'image', true],
    ]);
    expect(mediaKindFromUrl('https://x/y.MOV?x=1')).toBe('video');
    expect(mediaKindFromUrl('https://x/y.webp')).toBe('image');
  });

  it('la boucle ne contient que les actifs, filtrés par la sélection de la campagne', () => {
    expect(campaignMedia(lib, { media_ids: [] }).map((m) => m.id)).toEqual(['a', 'c']);
    expect(campaignMedia(lib, { media_ids: ['c', 'b'] }).map((m) => m.id)).toEqual(['c']);
    // sélection obsolète → tous les actifs
    expect(campaignMedia(lib, { media_ids: ['zzz'] }).map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('tourne en boucle sur le curseur et compose la légende', () => {
    const p0 = buildMediaPlan(lib, { media_ids: [], media_cursor: 0 }, { tagline: 'Maison & Confort', offerUrl: 'https://t/offer/1' });
    expect(p0?.item.id).toBe('a');
    expect(p0?.caption).toBe('Nouveautés !\n\n🛍️ Maison & Confort\n\n👉 https://t/offer/1');
    expect(buildMediaPlan(lib, { media_ids: [], media_cursor: 1 })?.item.id).toBe('c');
    expect(buildMediaPlan(lib, { media_ids: [], media_cursor: 2 })?.item.id).toBe('a');
    expect(buildMediaPlan([], { media_ids: [], media_cursor: 0 })).toBeNull();
  });
});

describe('créneaux médias de la campagne', () => {
  it('mode médias par défaut, 1 créneau par jour à 10 h', () => {
    const cfg = normalizeDripConfig({});
    expect(cfg.mode).toBe('media');
    expect(cfg.media_hours).toEqual([10]);
    expect(isMediaHour(10, cfg)).toBe(true);
    expect(isMediaHour(11, cfg)).toBe(false);
    expect(normalizeDripConfig({ mode: 'catalog' }).mode).toBe('catalog');
  });
  it('normalise les heures : uniques, triées, bornées', () => {
    expect(normalizeMediaHours([18, 10, '10', 25, -1, 'x'])).toEqual([10, 18]);
    expect(normalizeMediaHours([])).toEqual([10]);
  });
});
