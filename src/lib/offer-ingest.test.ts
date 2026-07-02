import { describe, it, expect } from 'vitest';
import {
  normalizePrice,
  normalizePriceTiers,
  normalizeDetailImages,
  foldVideoUrl,
  normalizeVariantsTotal,
  normalizeMeta,
  normalizeProductV31Fields,
  assessProductPricing,
} from './offer-ingest';

describe('normalizePrice — prix masqué / sur devis', () => {
  it('null reste null (sur devis)', () => {
    expect(normalizePrice(null)).toBeNull();
  });
  it('champ omis (undefined) → null', () => {
    expect(normalizePrice(undefined)).toBeNull();
  });
  it('chaîne vide → null', () => {
    expect(normalizePrice('')).toBeNull();
  });
  it('0 reste 0 (ne PAS confondre avec sur devis)', () => {
    expect(normalizePrice(0)).toBe(0);
  });
  it('nombre en string → number', () => {
    expect(normalizePrice('42.5')).toBe(42.5);
  });
});

describe('normalizePriceTiers — paliers triés', () => {
  it('champ omis → null', () => {
    expect(normalizePriceTiers(undefined)).toBeNull();
  });
  it('trie par min_qty croissant et filtre les entrées invalides', () => {
    const out = normalizePriceTiers([
      { min_qty: 100, price: 38 },
      { min_qty: 10, price: 45 },
      { min_qty: 50, price: 42.5 },
      { min_qty: 0, price: 99 }, // invalide (min_qty <= 0)
      { min_qty: 200 }, // invalide (price manquant)
    ]);
    expect(out).toEqual([
      { min_qty: 10, price: 45 },
      { min_qty: 50, price: 42.5 },
      { min_qty: 100, price: 38 },
    ]);
  });
  it('tableau vide ou 100% invalide → null', () => {
    expect(normalizePriceTiers([])).toBeNull();
    expect(normalizePriceTiers([{ min_qty: -1, price: 1 }])).toBeNull();
  });
});

describe('normalizeDetailImages', () => {
  it('champ omis → null', () => {
    expect(normalizeDetailImages(undefined)).toBeNull();
  });
  it('déduplique et exclut les images déjà utilisées', () => {
    const out = normalizeDetailImages(
      ['a.jpg', 'a.jpg', 'b.jpg', 'main.jpg', '  '],
      ['main.jpg'],
    );
    expect(out).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('foldVideoUrl — video_url replié dans videos[]', () => {
  it('préprend video_url en tête', () => {
    expect(foldVideoUrl(['x.mp4'], 'hero.mp4')).toEqual(['hero.mp4', 'x.mp4']);
  });
  it('pas de doublon si déjà présent', () => {
    expect(foldVideoUrl(['hero.mp4'], 'hero.mp4')).toEqual(['hero.mp4']);
  });
  it('aucune vidéo → null', () => {
    expect(foldVideoUrl(null, undefined)).toBeNull();
    expect(foldVideoUrl([], '')).toBeNull();
  });
});

describe('normalizeVariantsTotal — échantillon représentatif', () => {
  it('44 SKU réels pour 5 variantes listées → 44', () => {
    expect(normalizeVariantsTotal(44)).toBe(44);
  });
  it('champ omis / <= 0 → null', () => {
    expect(normalizeVariantsTotal(undefined)).toBeNull();
    expect(normalizeVariantsTotal(0)).toBeNull();
  });
});

describe('normalizeMeta — meta offre (quality/mode internes)', () => {
  it('meta absente → null', () => {
    expect(normalizeMeta(undefined)).toBeNull();
  });
  it('extrait note/marche_cible/tri et préserve quality (interne)', () => {
    const out = normalizeMeta({
      marche_cible: 'Afrique (import conteneur maritime)',
      tri: 'ventes / réachat',
      mode: 'catalogue interne (URLs + vendeurs visibles)',
      note: 'Fourchettes 38-45 CNY. Attention certifs CE.',
      quality: { products: 12, variants: 44, images: 80, warnings_count: 1, warnings: ['x'] },
    });
    expect(out?.note).toContain('38-45');
    expect(out?.marche_cible).toContain('Afrique');
    expect(out?.quality).toMatchObject({ products: 12, warnings_count: 1 });
  });
});

describe('assessProductPricing — validation prix (scrape incomplet)', () => {
  const noCtx = { tiers: null, variants: null };

  it('aucun signal de prix (price null, pas de range/tiers/variantes) → REJET', () => {
    const r = assessProductPricing({ price: null }, noCtx);
    expect(r.reject).toBe(true);
    expect(r.reason).toContain('re-scraper');
  });
  it('price null + price_range.min null → REJET', () => {
    const r = assessProductPricing({ price: null, price_range: { min: null, max: null } }, noCtx);
    expect(r.reject).toBe(true);
  });
  it('price null MAIS price_range.min présent → accepté', () => {
    expect(assessProductPricing({ price: null, price_range: { min: 30 } }, noCtx).reject).toBe(false);
  });
  it('price null MAIS price_tiers présents → accepté (signal de prix)', () => {
    const r = assessProductPricing({ price: null }, { tiers: [{ min_qty: 10, price: 42 }], variants: null });
    expect(r.reject).toBe(false);
  });
  it('price null MAIS une variante a un prix → accepté', () => {
    const r = assessProductPricing({ price: null }, { tiers: null, variants: [{ price: 280 }, { price: null }] });
    expect(r.reject).toBe(false);
  });
  it('produit chiffré mais TOUTES les variantes sans prix → warning (conservé)', () => {
    const r = assessProductPricing({ price: 100 }, { tiers: null, variants: [{ price: null }, { price: null }] });
    expect(r.reject).toBe(false);
    expect(r.warning).toContain('variantes sans prix');
  });
  it('produit chiffré, variantes chiffrées → ni rejet ni warning', () => {
    const r = assessProductPricing({ price: 100 }, { tiers: null, variants: [{ price: 90 }] });
    expect(r).toEqual({ reject: false });
  });
});

describe('normalizeProductV31Fields — intégration', () => {
  it('produit minimal (tous champs omis) : aucun crash, valeurs null', () => {
    const out = normalizeProductV31Fields({}, { existingVideos: null, excludeImages: [] });
    expect(out).toEqual({
      price: null,
      price_tiers: null,
      detail_images: null,
      videos: null,
      variants_total: null,
      description_source: null,
    });
  });
  it('produit v3.1 complet : prix null + tiers + detail_images + video repliée + variants_total', () => {
    const out = normalizeProductV31Fields(
      {
        price: null,
        price_tiers: [{ min_qty: 50, price: 42.5 }, { min_qty: 10, price: 45 }],
        detail_images: ['schema.jpg', 'main.jpg'],
        video_url: 'demo.mp4',
        variants_total: 44,
        description_source: '1688 item_detail',
      },
      { existingVideos: ['old.mp4'], excludeImages: ['main.jpg'] },
    );
    expect(out.price).toBeNull();
    expect(out.price_tiers).toEqual([{ min_qty: 10, price: 45 }, { min_qty: 50, price: 42.5 }]);
    expect(out.detail_images).toEqual(['schema.jpg']);
    expect(out.videos).toEqual(['demo.mp4', 'old.mp4']);
    expect(out.variants_total).toBe(44);
    expect(out.description_source).toBe('1688 item_detail');
  });
});
