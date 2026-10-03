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
  facebookPostsFor,
  instagramPostsFor,
  maxProductsPerHour,
  normalizeDripConfig,
  pickCategory,
  productsFor,
  dripRitual,
  dripSettingKey,
  parseDripSlot,
} from './wa-drip';
import { MAX_DRIP_SLOTS, dailyVolume, fluxTarget, isProductHour, isV2Config, nextFreeDripSlot, storedLock } from './wa-drip';

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
  offer: { id: 'o1', title: 'Maison & Confort', theme: null, description: null, cover_image_url: null, cover_video_url: null, mobile_video_url: null, note: null, currency: 'XAF', offer_type: 'b2c', best_sellers: { enabled: false, product_ids: [], title: null } },
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
    expect(normalizeDripConfig({})).toEqual(DEFAULT_DRIP_CONFIG);
    const cfg = normalizeDripConfig({ products_enabled: true, enabled: true, offer_id: 'o1', group_id: 'g@g.us', per_category: 99, product_hours: [30, 9, 9, 18], cursor: '7' });
    expect(cfg).toMatchObject({ enabled: true, offer_id: 'o1', group_id: 'g@g.us', per_category: 5, product_hours: [9, 18], cursor: 7 });
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
    const cfg = normalizeDripConfig({ products_enabled: true, products_channels: { status: true, facebook: 'oui' } });
    expect(cfg.products_channels).toEqual({ group: true, status: true, channel: false, facebook: false, instagram: false });
    expect(cfg.announce_channels).toEqual({ group: true, status: false, channel: false, facebook: false, instagram: false });
    expect(cfg.per_hour_other).toBe(1);
    expect(cfg.channel_id).toBeNull();
  });

  it('rappelle le listing et son thème dans l’en-tête et les légendes', () => {
    const data = { ...DATA, offer: { ...DATA.offer, theme: 'Tout pour la chambre' } };
    const plan = buildDripPlan(data, { ...DEFAULT_DRIP_CONFIG, per_category: 1, per_hour_other: 2 }, 'https://t/offer/o1')!;
    expect(plan.header).toContain('🛍️ Maison & Confort — Tout pour la chambre');
    expect(plan.header.split('\n\n')).toHaveLength(4); // titre / phase / note / listing
    expect(plan.products[0].caption).toContain('Maison & Confort — Tout pour la chambre');
    expect(plan.products[0].social).toContain('Maison & Confort — Tout pour la chambre');
    expect(plan.products[0].social).not.toContain('*');
    expect(plan.products[0].cardBody).not.toContain('http');
    // une ligne vide entre titre, prix et rappel du listing
    expect(plan.products[0].cardBody.split('\n\n')).toHaveLength(3);
    expect(plan.products[0].caption.split('\n\n')).toHaveLength(4);
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
    // Facebook : stories et publications séparées (0 publication autorisé)
    const fb = normalizeDripConfig({ per_channel: { facebook: 5, facebook_posts: 0 } });
    expect(productsFor(fb, 'facebook')).toBe(5);
    expect(facebookPostsFor(fb)).toBe(0);
    expect(facebookPostsFor(normalizeDripConfig({}))).toBe(1);
    const ig = normalizeDripConfig({ per_channel: { instagram: 1, instagram_posts: 0 } });
    expect(instagramPostsFor(ig)).toBe(0);
    expect(instagramPostsFor(normalizeDripConfig({}))).toBe(1);
  });
});

describe('campagnes simultanées (emplacements)', () => {
  it('garde la clé historique pour la campagne 1 et suffixe les autres', () => {
    expect(dripSettingKey(1)).toBe('category_drip');
    expect(dripSettingKey(2)).toBe('category_drip:2');
    expect(dripRitual(1)).toBe('category_drip');
    expect(dripRitual(3)).toBe('category_drip:3');
  });
  it('retombe sur la campagne 1 pour toute valeur invalide', () => {
    expect(parseDripSlot('2')).toBe(2);
    expect(parseDripSlot(undefined)).toBe(1);
    expect(parseDripSlot(0)).toBe(1);
    expect(parseDripSlot(99)).toBe(1);
    expect(parseDripSlot('abc')).toBe(1);
  });
});

describe('nextFreeDripSlot — « Nouvelle campagne »', () => {
  it('prend le premier emplacement libre, même au milieu', () => {
    expect(nextFreeDripSlot([])).toBe(1);
    expect(nextFreeDripSlot([1, 2, 3])).toBe(4);
    expect(nextFreeDripSlot([1, 3])).toBe(2);
  });
  it('null quand tous les emplacements sont pris', () => {
    expect(nextFreeDripSlot(Array.from({ length: MAX_DRIP_SLOTS }, (_, i) => i + 1))).toBeNull();
  });
});

describe('anciennes campagnes (un seul mode) → une campagne, deux flux', () => {
  it('le mode catalogue devient le flux produits, avec ses canaux, sa fenêtre et son verrou', () => {
    const cfg = normalizeDripConfig({
      enabled: true, mode: 'catalog', offer_id: 'o1', group_id: 'g@g.us', start_hour: 9, end_hour: 12,
      channels: { group: true, status: true }, last_run_at: '2026-10-01T10:00:00Z', cursor: 4,
    });
    expect(cfg.products_enabled).toBe(true);
    expect(cfg.announcements_enabled).toBe(false);
    expect(cfg.product_hours).toEqual([9, 10, 11, 12]);
    expect(cfg.products_channels.status).toBe(true);
    expect(cfg.announce_channels).toEqual({ group: true, status: false, channel: false, facebook: false, instagram: false });
    expect(cfg.last_run_at).toBe('2026-10-01T10:00:00Z');
    expect(cfg.media_last_run_at).toBeNull();
    expect(cfg.cursor).toBe(4);
  });

  it('le mode médias (ou sans mode) devient le flux annonces, verrou compris', () => {
    const cfg = normalizeDripConfig({
      enabled: true, group_id: 'g@g.us', media_hours: [10, 18], channels: { facebook: true, instagram: true },
      per_channel: { facebook_posts: 0 }, last_run_at: '2026-10-01T09:00:00Z',
    });
    expect(cfg.announcements_enabled).toBe(true);
    expect(cfg.products_enabled).toBe(false);
    expect(cfg.announce_channels.facebook).toBe(true);
    expect(cfg.announce_posts).toEqual({ facebook: false, instagram: true });
    expect(cfg.media_hours).toEqual([10, 18]);
    expect(cfg.media_last_run_at).toBe('2026-10-01T09:00:00Z');
    expect(cfg.last_run_at).toBeNull();
  });

  it('retrouve le verrou là où il est stocké', () => {
    expect(storedLock({ mode: 'catalog', last_run_at: 'A' }, 'products')).toEqual({ path: 'last_run_at', value: 'A' });
    expect(storedLock({ mode: 'media', last_run_at: 'B' }, 'announcements')).toEqual({ path: 'last_run_at', value: 'B' });
    expect(storedLock({ products_enabled: true, last_run_at: 'C', media_last_run_at: 'D' }, 'announcements')).toEqual({ path: 'media_last_run_at', value: 'D' });
    expect(storedLock({ products_enabled: true }, 'products')).toEqual({ path: 'last_run_at', value: null });
    expect(isV2Config({ mode: 'media' })).toBe(false);
    expect(isV2Config({ announcements_enabled: false })).toBe(true);
  });
});

describe('flux d’une campagne', () => {
  const cfg = normalizeDripConfig({
    enabled: true, products_enabled: true, announcements_enabled: true, group_id: 'g@g.us', channel_id: 'c@newsletter',
    product_hours: [9, 15], per_category: 3, products_channels: { group: true, status: true, facebook: true },
    per_channel: { status: 2, facebook: 2, facebook_posts: 1 },
    media_hours: [10], announce_channels: { group: true, instagram: true }, announce_posts: { facebook: true, instagram: false },
  });

  it('chaque flux a ses canaux, les destinations sont celles de la campagne', () => {
    const p = fluxTarget(cfg, 'products');
    expect(p.channels.status).toBe(true);
    expect(p.channels.instagram).toBe(false);
    expect(p.group_id).toBe('g@g.us');
    expect(p.social_posts).toBeUndefined();
    const a = fluxTarget(cfg, 'announcements');
    expect(a.channels.status).toBe(false);
    expect(a.channels.instagram).toBe(true);
    expect(a.social_posts).toEqual({ facebook: true, instagram: false });
    expect(isProductHour(15, cfg)).toBe(true);
    expect(isProductHour(10, cfg)).toBe(false);
  });

  it('estime le volume quotidien par canal', () => {
    const v = dailyVolume(cfg, 2);
    // produits : 2 créneaux × (3 groupe, 2 statut, 2 stories + 1 publication Facebook) ; annonces : 1 créneau × 2 annonces (groupe, story Instagram)
    expect(v).toEqual({ group: 2 * 3 + 2, status: 2 * 2, channel: 0, facebook: 2 * 3, instagram: 2 });
    expect(dailyVolume({ ...cfg, enabled: false }, 2)).toEqual({ group: 0, status: 0, channel: 0, facebook: 0, instagram: 0 });
    expect(dailyVolume({ ...cfg, products_enabled: false }, 0).group).toBe(0);
  });
});
