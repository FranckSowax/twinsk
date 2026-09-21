import { describe, expect, it } from 'vitest';
import { fromCatalogTable, fromOfferProduct, mergePage, sourcesToQuery } from './catalog-merge';

const cat = fromCatalogTable({
  id: 'c1', source: '1688', title: 'Presse-agrumes', price: 120, search_count: 7,
  created_at: '2026-05-01T00:00:00Z', last_seen_at: '2026-09-01T00:00:00Z', moq: 2,
});
const b2c = fromOfferProduct({
  id: 'p1', title: 'Set vaisselle', price: 260, created_at: '2026-08-01T00:00:00Z',
  offer_items: { offer_id: 'o1', offers: { title: 'Set Vaisselle', offer_type: 'b2c', status: 'published' } },
});
const b2b = fromOfferProduct({
  id: 'p2', title: 'Four à pizza', price: 3400, created_at: '2026-09-10T00:00:00Z',
  offer_items: [{ offer_id: 'o2', offers: [{ title: 'Pizzeria', offer_type: 'b2b', status: 'draft' }] }],
});

describe('catalogue unifié : sourcing + produits des listings', () => {
  it('un produit de listing porte sa source B2C ou B2B et son listing', () => {
    expect(b2c.origin).toBe('offer');
    expect(b2c.source).toBe('b2c');
    expect(b2c.offer_title).toBe('Set Vaisselle');
    expect(b2b.source).toBe('b2b');
    expect(b2b.offer_status).toBe('draft');   // la jointure marche aussi en tableau
    expect(b2b.offer_id).toBe('o2');
  });
  it('une ligne de sourcing garde sa source et son compteur', () => {
    expect(cat.origin).toBe('catalog');
    expect(cat.source).toBe('1688');
    expect(cat.search_count).toBe(7);
    expect(fromOfferProduct({ id: 'x', title: 't', created_at: '' }).search_count).toBe(0);
  });
  it('fusionne et trie les deux sources ensemble', () => {
    expect(mergePage([[cat], [b2c, b2b]], 'newest', 1, 10).map((r) => r.id)).toEqual(['p2', 'p1', 'c1']);
    expect(mergePage([[cat], [b2c, b2b]], 'price_asc', 1, 10).map((r) => r.id)).toEqual(['c1', 'p1', 'p2']);
    expect(mergePage([[cat], [b2c, b2b]], 'search_count', 1, 10)[0].id).toBe('c1');
  });
  it('découpe la page après la fusion, pas avant', () => {
    const p2 = mergePage([[cat], [b2c, b2b]], 'newest', 2, 2);
    expect(p2.map((r) => r.id)).toEqual(['c1']);
  });
  it('le filtre de source évite d’interroger la table inutile', () => {
    expect(sourcesToQuery('')).toEqual({ catalog: true, offer: true });
    expect(sourcesToQuery('b2b')).toEqual({ catalog: false, offer: true });
    expect(sourcesToQuery('1688')).toEqual({ catalog: true, offer: false });
  });
});
