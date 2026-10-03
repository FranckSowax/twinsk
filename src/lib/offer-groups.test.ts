import { describe, expect, it } from 'vitest';
import { groupOffersByKind, offerKind } from './offer-groups';

describe('groupOffersByKind', () => {
  it('sépare B2C puis B2B, trie par titre et omet les groupes vides', () => {
    const groups = groupOffersByKind([
      { id: '1', title: 'Pizzeria', offer_type: 'b2b' },
      { id: '2', title: 'Canapés', offer_type: 'b2c' },
      { id: '3', title: 'bar à ongles', offer_type: 'b2b' },
      { id: '4', title: 'Ancien listing', offer_type: null },
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['b2c', 'b2b']);
    expect(groups[0].items.map((o) => o.id)).toEqual(['4', '2']);
    expect(groups[1].items.map((o) => o.id)).toEqual(['3', '1']);
    expect(groupOffersByKind([{ title: 'X', offer_type: 'b2c' }]).map((g) => g.kind)).toEqual(['b2c']);
    expect(offerKind({})).toBe('b2c');
  });
});
