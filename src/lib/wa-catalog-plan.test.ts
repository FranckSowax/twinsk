import { describe, expect, it } from 'vitest';
import type { PublicOfferData } from './offer-public-fetch';
import { FX_RATES, roundXafUp } from './utils/formatCurrency';
import {
  buildCatalogPlan,
  COLLECTION_NAME_MAX,
  isEligible,
  PRODUCT_NAME_MAX,
  shortProductName,
  toProductInput,
  uniqueGallery,
} from './wa-catalog-plan';

type Product = PublicOfferData['items'][number]['products'][number];

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    id,
    title: `Produit ${id}`,
    title_original: null,
    description: null,
    image_url: `https://img/${id}.jpg`,
    thumbnail_url: '',
    gallery: [],
    detail_images: [],
    videos: [],
    price: 100,
    from_price: 100,
    on_quote: false,
    price_type: null,
    price_note: null,
    in_cover_video: false,
    price_tiers: null,
    variants_total: null,
    moq: null,
    weight: null,
    volume: null,
    dimensions: null,
    dimensions_cm: null,
    has_battery: false,
    info_manquante: null,
    seller: null,
    product_url: '',
    variants: null,
    ...over,
  };
}

function item(id: string, phase_id: string | null, products: Product[]): PublicOfferData['items'][number] {
  return { id, image_url: null, description: `Catégorie ${id} — note`, phase_id, products };
}

function offer(phases: PublicOfferData['phases'], items: PublicOfferData['items']): PublicOfferData {
  return {
    offer: {
      id: 'offer-1',
      title: 'Maison & Confort',
      theme: null,
      description: null,
      cover_image_url: null,
      cover_video_url: null,
      mobile_video_url: null,
      note: null,
      currency: 'XAF',
      offer_type: 'b2c',
    },
    phases,
    items,
  };
}

const OPTS = { offerUrl: 'https://twinsk.test/offer/offer-1' };

describe('isEligible', () => {
  it('exige un prix affiché et une image', () => {
    expect(isEligible(product('a'))).toBe(true);
    expect(isEligible(product('b', { on_quote: true, from_price: 0 }))).toBe(false);
    expect(isEligible(product('c', { from_price: 0 }))).toBe(false);
    expect(isEligible(product('d', { image_url: '' }))).toBe(false);
  });
});

describe('toProductInput', () => {
  it('construit une fiche « à partir de » en FCFA avec la galerie et le lien listing', () => {
    const p = product('p1', { from_price: 250, gallery: ['g1', 'g2'], description: 'Desc' });
    const input = toProductInput(p, OPTS.offerUrl, 'XAF');
    expect(input.price).toBe(roundXafUp(250 * FX_RATES.XAF));
    // image principale en tête, puis la galerie, sans doublon
    expect(input.images).toEqual(['https://img/p1.jpg', 'g1', 'g2']);
    expect(input.url).toBe(`${OPTS.offerUrl}?p=p1`);
    expect(input.retailerId).toBe('p1');
    expect(input.description).toBe('Desc');
  });

  it('retombe sur l’image principale sans galerie et sur le titre sans description', () => {
    const input = toProductInput(product('p2'), OPTS.offerUrl, 'XAF');
    expect(input.images).toEqual(['https://img/p2.jpg']);
    expect(input.description).toBe('Produit p2');
  });
});

describe('buildCatalogPlan — listing phasé', () => {
  const data = offer(
    [
      { id: 'ph1', title: 'Literie complète' },
      { id: 'ph2', title: 'Mobilier' },
    ],
    [
      item('c1', 'ph1', [product('a1'), product('a2'), product('a3')]),
      // le premier produit est sur devis : on prend le suivant
      item('c2', 'ph1', [product('b1', { on_quote: true, from_price: 0 }), product('b2')]),
      // aucune fiche publiable : la catégorie disparaît du catalogue
      item('c3', 'ph1', [product('c1x', { image_url: '' })]),
      item('c4', 'ph2', [product('d1'), product('d2')]),
    ],
  );

  it('fait une collection par phase, nommée du titre de la phase', () => {
    const plan = buildCatalogPlan(data, OPTS);
    expect(plan.groupedBy).toBe('phase');
    expect(plan.collections.map((c) => c.name)).toEqual(['Literie complète', 'Mobilier']);
  });

  it('retient le premier produit éligible de chaque catégorie, une fiche par produit', () => {
    const plan = buildCatalogPlan(data, OPTS);
    const literie = plan.collections[0];
    expect(literie.entries.map((e) => e.key)).toEqual(['a1', 'b2']);
    expect(literie.categories).toBe(2);
    expect(plan.totalFiches).toBe(3);
  });

  it('compte les produits écartés', () => {
    const plan = buildCatalogPlan(data, OPTS);
    // c1 : 2 écartés · c2 : 1 · c3 : 1 · c4 : 1
    expect(plan.skipped).toBe(5);
  });

  it('respecte le quota par catégorie', () => {
    const plan = buildCatalogPlan(data, { ...OPTS, perCategory: 2 });
    expect(plan.collections[0].entries.map((e) => e.key)).toEqual(['a1', 'a2', 'b2']);
  });

  it('se limite aux phases cochées', () => {
    const plan = buildCatalogPlan(data, { ...OPTS, groupIds: new Set(['ph2']) });
    expect(plan.collections.map((c) => c.key)).toEqual(['ph2']);
    expect(plan.totalFiches).toBe(1);
  });

  it('regroupe les catégories sans phase sous « Sans phase »', () => {
    const plan = buildCatalogPlan(offer([{ id: 'ph1', title: 'P' }], [item('c9', null, [product('z')])]), OPTS);
    expect(plan.collections[0]).toMatchObject({ key: '', name: 'Sans phase' });
  });

  it('ne publie jamais deux fois le même produit', () => {
    const shared = product('dup');
    const plan = buildCatalogPlan(
      offer([{ id: 'ph1', title: 'P' }], [item('c1', 'ph1', [shared]), item('c2', 'ph1', [shared])]),
      OPTS,
    );
    expect(plan.totalFiches).toBe(1);
    expect(plan.collections[0].categories).toBe(1);
  });

  it('tronque les noms de collection trop longs', () => {
    const long = 'x'.repeat(COLLECTION_NAME_MAX + 20);
    const plan = buildCatalogPlan(offer([{ id: 'ph1', title: long }], [item('c1', 'ph1', [product('a')])]), OPTS);
    expect(plan.collections[0].name).toHaveLength(COLLECTION_NAME_MAX);
  });
});

describe('buildCatalogPlan — listing sans phases', () => {
  it('fait une seule collection au nom du listing', () => {
    const data = offer([], [item('c1', null, [product('a'), product('b')]), item('c2', null, [product('c')])]);
    const plan = buildCatalogPlan(data, OPTS);
    expect(plan.groupedBy).toBe('listing');
    expect(plan.collections).toHaveLength(1);
    expect(plan.collections[0]).toMatchObject({ key: 'offer-1', name: 'Maison & Confort', categories: 2 });
    expect(plan.collections[0].entries.map((e) => e.key)).toEqual(['a', 'c']);
  });
});

describe('contraintes Meta sur la fiche', () => {
  it('coupe un titre trop long sur un mot, sans ponctuation pendante', () => {
    const long = 'Lampe de bureau LED pliable pour enfant, protection des yeux, trois modes de lumière et port USB';
    const name = shortProductName(long);
    expect(name.length).toBeLessThanOrEqual(PRODUCT_NAME_MAX);
    expect(name).toBe('Lampe de bureau LED pliable pour enfant, protection des');
    expect(shortProductName('Court')).toBe('Court');
  });

  it('dédoublonne la galerie en gardant l’image principale en tête', () => {
    expect(uniqueGallery({ image_url: 'a', gallery: ['b', 'a', 'c', 'b'] })).toEqual(['a', 'b', 'c']);
    expect(uniqueGallery({ image_url: 'a', gallery: [] })).toEqual(['a']);
  });

  it('applique les deux dans toProductInput', () => {
    const p = product('p9', { title: 'x'.repeat(80), gallery: ['https://img/p9.jpg', 'g2'] });
    const input = toProductInput(p, 'u', 'XAF');
    expect(input.name.length).toBeLessThanOrEqual(PRODUCT_NAME_MAX);
    expect(input.images).toEqual(['https://img/p9.jpg', 'g2']);
  });
});
