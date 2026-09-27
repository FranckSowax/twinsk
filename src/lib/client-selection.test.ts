import { describe, expect, it } from 'vitest';
import { buildSelectionIntro, MAX_SELECTION_PRODUCTS, normalizeSelectionItems, selectionAddUrl } from './client-selection';

describe('sélection client', () => {
  it('lien « Ajouter au panier » propre à la sélection et au produit', () => {
    expect(selectionAddUrl('https://x.test', 'sel-1', 'prod-9')).toBe('https://x.test/s/sel-1/prod-9');
  });

  it('produits dédupliqués, variante vide = aucune, limite respectée', () => {
    const items = normalizeSelectionItems([
      { product_id: 'a' }, { product_id: 'a', variant_id: 'v' }, { product_id: 'b', variant_id: '' }, { product_id: 'c', variant_id: 'v2' }, { foo: 1 },
    ]);
    expect(items).toEqual([
      { product_id: 'a', variant_id: null },
      { product_id: 'b', variant_id: null },
      { product_id: 'c', variant_id: 'v2' },
    ]);
    const many = normalizeSelectionItems(Array.from({ length: 30 }, (_, i) => ({ product_id: `p${i}` })));
    expect(many).toHaveLength(MAX_SELECTION_PRODUCTS);
    expect(normalizeSelectionItems('pas un tableau')).toEqual([]);
  });

  it('message d’accueil : prénom, nombre de produits, mot personnel, mode d’emploi des boutons', () => {
    const t = buildSelectionIntro({ clientName: 'Awa', tagline: 'Canapés — Maison', count: 3, message: '  Comme convenu au téléphone  ' });
    expect(t).toContain('Bonjour Awa');
    expect(t).toContain('3 produits sélectionnés');
    expect(t).toContain('Comme convenu au téléphone');
    expect(t).toContain('*Ajouter au panier*');
    expect(buildSelectionIntro({ clientName: 'Awa', tagline: 'x', count: 1 })).toContain('un produit sélectionné');
  });
});
