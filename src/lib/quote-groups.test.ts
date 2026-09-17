import { describe, expect, it } from 'vitest';
import { groupQuoteItems } from './quote-groups';

describe('groupQuoteItems — variantes regroupées sous leur produit', () => {
  it('garde les produits simples et regroupe les lignes-variantes consécutives du même produit', () => {
    const items = [
      { product_key: 'p1', variant_name: null, title: 'A' },
      { product_key: 'p2', variant_name: 'Rouge', title: 'B' },
      { product_key: 'p2', variant_name: 'Bleu', title: 'B' },
      { product_key: 'p3', variant_name: 'XL', title: 'C' },
      { product_key: 'p4', variant_name: null, title: 'D' },
    ];
    const g = groupQuoteItems(items);
    expect(g.map((x) => x.kind)).toEqual(['single', 'variants', 'variants', 'single']);
    expect(g[1].kind === 'variants' && g[1].variants.map((v) => v.variant_name)).toEqual(['Rouge', 'Bleu']);
    expect(g[2].kind === 'variants' && g[2].variants).toHaveLength(1);
  });
});
