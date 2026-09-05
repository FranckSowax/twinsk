import { describe, expect, it } from 'vitest';
import { BEST_SELLERS_MAX, normalizeBestSellers } from './best-sellers';

describe('normalizeBestSellers', () => {
  it('retourne une galerie vide et désactivée pour une valeur absente', () => {
    expect(normalizeBestSellers(null)).toEqual({ enabled: false, product_ids: [], title: null });
    expect(normalizeBestSellers('x')).toEqual({ enabled: false, product_ids: [], title: null });
  });
  it('dédoublonne, ignore les valeurs non textuelles et plafonne à 12', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
    const r = normalizeBestSellers({ enabled: true, product_ids: ['a', 'a', 7, '', ...ids] });
    expect(r.product_ids.length).toBe(BEST_SELLERS_MAX);
    expect(r.product_ids[0]).toBe('a');
    expect(r.product_ids.filter((x) => x === 'a').length).toBe(1);
  });
  it('ne peut pas être activée sans produit, et tronque le titre', () => {
    expect(normalizeBestSellers({ enabled: true, product_ids: [] }).enabled).toBe(false);
    expect(normalizeBestSellers({ enabled: true, product_ids: ['a'], title: `  ${'x'.repeat(80)} ` }).title?.length).toBe(60);
    expect(normalizeBestSellers({ enabled: true, product_ids: ['a'], title: '  ' }).title).toBeNull();
  });
});
