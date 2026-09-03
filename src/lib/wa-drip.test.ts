import { describe, expect, it } from 'vitest';
import type { PublicOfferData } from './offer-public-fetch';
import {
  DEFAULT_DRIP_CONFIG,
  alreadyRanThisHour,
  buildDripPlan,
  cleanCategoryNote,
  isInWindow,
  listDripCategories,
  localHour,
  localHourKey,
  maxProductsPerHour,
  normalizeDripConfig,
  pickCategory,
  productsFor,
} from './wa-drip';

type Product = PublicOfferData['items'][number]['products'][number];

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    id, title: `Produit ${id}`, title_original: null, description: null,
    image_url: `https://img/${id}.jpg`, thumbnail_url: '', gallery: [], detail_images: [], videos: [],
    price: 100, from_price: 100, on_quote: false, price_type: null, price_note: null, in_cover_video: false,
    price_tiers: null, variants_total: null, moq: null, weight: null, volume: null, dimensions: null,
    dimensions_cm: null, has_battery: false, info_manquante: null, seller: null, product_url: '', variants: null,
    ...over,
  };
}
function item(id: string, phase_id: string | null, desc: string, products: Product[]): PublicOfferData['items'][number] {
  return { id, image_url: null, description: desc, phase_id, products };
}
const DATA: PublicOfferData = {
  offer: { id: 'o1', title: 'Maison & Confort', theme: null, description: null, cover_image_url: null, cover_video_url: null, mobile_video_url: null, note: null, currency: 'XAF', offer_type: 'b2c' },
  phases: [{ id: 'ph1', title: 'Literie complète' }],
  items: [
    item('c1', 'ph1', 'Matelas roll-pack enfant — Matelas compressés, livrés roulés', [product('a1'), product('a2'), product('a3'), product('a4')]),
    item('c2', 'ph1', 'Catégorie vide — rien de publiable', [product('b1', { on_quote: true, from_price: 0 })]),
    item('c3', null, 'Barrières de lit', [product('c1x')]),
  ],
};

describe('heure de Libreville (UTC+1, sans heure d’été)', () => {
  it('convertit l’UTC en heure locale', () => {
    expect(localHour(new Date('2026-09-02T07:30:00Z'))).toBe(8);
    expect(localHour(new Date('2026-09-02T08:00:00Z'))).toBe(9);
    expect(localHour(new Date('2026-09-02T22:59:00Z'))).toBe(23);
    expect(localHour(new Date('2026-09-02T23:00:00Z'))).toBe(0);
  });

  it('respecte la fenêtre 9h–23h incluses', () => {
    const cfg = { start_hour: 9, end_hour: 23 };
    expect(isInWindow(8, cfg)).toBe(false);
    expect(isInWindow(9, cfg)).toBe(true);
    expect(isInWindow(23, cfg)).toBe(true);
    expect(isInWindow(0, cfg)).toBe(false);
  });

  it('n’envoie qu’une fois par heure locale, même si le cron repasse', () => {
    const now = new Date('2026-09-02T10:40:00Z');
    expect(localHourKey(now)).toBe('2026-09-02-11');
    expect(alreadyRanThisHour({ last_run_at: '2026-09-02T10:05:00Z' }, now)).toBe(true);
    expect(alreadyRanThisHour({ last_run_at: '2026-09-02T09:59:00Z' }, now)).toBe(false);
    expect(alreadyRanThisHour({ last_run_at: null }, now)).toBe(false);
    expect(alreadyRanThisHour({ last_run_at: 'pas une date' }, now)).toBe(false);
  });
});

describe('normalizeDripConfig', () => {
  it('applique les défauts et borne les valeurs', () => {
    expect(normalizeDripConfig(null)).toEqual(DEFAULT_DRIP_CONFIG);
    const cfg = normalizeDripConfig({ enabled: true, offer_id: 'o1', group_id: 'g@g.us', per_category: 99, start_hour: -3, end_hour: 30, cursor: '7' });
    expect(cfg).toMatchObject({ enabled: true, offer_id: 'o1', group_id: 'g@g.us', per_category: 5, start_hour: 0, end_hour: 23, cursor: 7 });
  });
});

describe('sélection de la catégorie', () => {
  it('ignore les catégories sans produit publiable et garde l’ordre du listing', () => {
    const cats = listDripCategories(DATA);
    expect(cats.map((c) => c.item.id)).toEqual(['c1', 'c3']);
    expect(cats[0].phaseTitle).toBe('Literie complète');
    expect(cats[1].phaseTitle).toBeNull();
  });

  it('tourne en boucle sur le curseur', () => {
    const cats = listDripCategories(DATA);
    expect(pickCategory(cats, 0)?.category.item.id).toBe('c1');
    expect(pickCategory(cats, 1)?.category.item.id).toBe('c3');
    expect(pickCategory(cats, 2)?.category.item.id).toBe('c1');
    expect(pickCategory([], 0)).toBeNull();
  });
});

describe('buildDripPlan', () => {
  it('compose l’en-tête et limite les produits à per_category', () => {
    const plan = buildDripPlan(DATA, { ...DEFAULT_DRIP_CONFIG, per_category: 3, cursor: 0 }, 'https://t/offer/o1');
    expect(plan).not.toBeNull();
    expect(plan!.categoryTitle).toBe('Matelas roll-pack enfant');
    expect(plan!.header).toContain('📦 *Matelas roll-pack enfant*');
    expect(plan!.header).toContain('_Literie complète_');
    expect(plan!.header).toContain('Matelas compressés');
    expect(plan!.products.map((p) => p.id)).toEqual(['a1', 'a2', 'a3']);
    expect(plan!.products[0].caption).toContain('FCFA');
    expect(plan!.products[0].caption).toContain('https://t/offer/o1?p=a1');
    expect(plan!.products[0].url).toBe('https://t/offer/o1?p=a1');
    expect(plan!.total).toBe(2);
  });

  it('renvoie null sans catégorie publiable', () => {
    expect(buildDripPlan({ ...DATA, items: [] }, DEFAULT_DRIP_CONFIG, 'u')).toBeNull();
  });
});

describe('cleanCategoryNote', () => {
  it('retire les scories d’import et coupe proprement', () => {
    const raw = 'Matelas enfant compressés/roulés (roll-pack) coco/palme — encombrement réduit optimal pour groupage. Top 5 fournisseurs distincts. — top ventes — top ventes — Matelas à ressorts comprimés sous vide et livrés roulés, à déballer 48 h avant usage pour reprendre leur épaisseur nominale.';
    const note = cleanCategoryNote(raw, 120);
    expect(note).not.toMatch(/top ventes/i);
    expect(note).not.toMatch(/fournisseurs distincts/i);
    expect(note.length).toBeLessThanOrEqual(121);
    expect(note.startsWith('Matelas enfant compressés/roulés')).toBe(true);
    expect(note.endsWith('…')).toBe(true);
  });

  it('laisse une note courte intacte', () => {
    expect(cleanCategoryNote('Barrières anti-chute rabattables.')).toBe('Barrières anti-chute rabattables.');
  });
});

describe('canaux et rappel du listing', () => {
  it('normalise les canaux avec des défauts sûrs (groupe seul actif)', () => {
    const cfg = normalizeDripConfig({ channels: { status: true, facebook: 'oui' } });
    expect(cfg.channels).toEqual({ group: true, status: true, channel: false, facebook: false, instagram: false });
    expect(cfg.per_hour_other).toBe(1);
    expect(cfg.channel_id).toBeNull();
  });

  it('rappelle le listing et son thème dans l’en-tête et les légendes', () => {
    const data = { ...DATA, offer: { ...DATA.offer, theme: 'Tout pour la chambre' } };
    const plan = buildDripPlan(data, { ...DEFAULT_DRIP_CONFIG, per_category: 1, per_hour_other: 2 }, 'https://t/offer/o1')!;
    expect(plan.header).toContain('🛍️ Maison & Confort — Tout pour la chambre');
    expect(plan.products[0].caption).toContain('Maison & Confort — Tout pour la chambre');
    expect(plan.products[0].social).toContain('Maison & Confort — Tout pour la chambre');
    expect(plan.products[0].social).not.toContain('*');
    expect(plan.products[0].cardBody).not.toContain('http');
    expect(plan.tagline).toBe('Maison & Confort — Tout pour la chambre');
    // on planifie le max des deux rythmes ; chaque canal prend sa part
    expect(plan.products).toHaveLength(2);
  });
});

describe('rythme par canal', () => {
  it('prend la valeur du canal, sinon le défaut, et dimensionne le plan au maximum', () => {
    const cfg = normalizeDripConfig({ per_category: 5, per_hour_other: 1, per_channel: { status: 5, channel: 5, facebook: 5, instagram: 99, group: 3 } });
    expect(cfg.per_channel).toEqual({ status: 5, channel: 5, facebook: 5, instagram: 5 });
    expect(productsFor(cfg, 'group')).toBe(5);
    expect(productsFor(cfg, 'status')).toBe(5);
    expect(productsFor({ ...cfg, per_channel: {} }, 'instagram')).toBe(1);
    expect(maxProductsPerHour({ ...cfg, per_category: 2, per_channel: { facebook: 4 } })).toBe(4);
  });
});
