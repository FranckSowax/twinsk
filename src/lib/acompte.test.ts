import { describe, it, expect } from 'vitest';
import { isAcompte, variantIsAcompte, PRICE_TYPE_ACOMPTE } from './acompte';

describe('isAcompte', () => {
  it('true seulement pour "acompte"', () => {
    expect(isAcompte(PRICE_TYPE_ACOMPTE)).toBe(true);
    expect(isAcompte('acompte')).toBe(true);
  });
  it('false pour tout le reste (tolérant aux absents)', () => {
    expect(isAcompte(null)).toBe(false);
    expect(isAcompte(undefined)).toBe(false);
    expect(isAcompte('')).toBe(false);
    expect(isAcompte('normal')).toBe(false);
    expect(isAcompte('Acompte')).toBe(false); // sensible à la casse
    expect(isAcompte(0)).toBe(false);
  });
});

describe('variantIsAcompte — héritage', () => {
  it('produit acompte → variante acompte même si champ absent', () => {
    expect(variantIsAcompte('acompte', undefined)).toBe(true);
    expect(variantIsAcompte('acompte', null)).toBe(true);
    expect(variantIsAcompte('acompte', 'normal')).toBe(true);
  });
  it('variante acompte alors que produit normal → acompte', () => {
    expect(variantIsAcompte(null, 'acompte')).toBe(true);
  });
  it('aucun des deux acompte → false', () => {
    expect(variantIsAcompte(null, null)).toBe(false);
    expect(variantIsAcompte(undefined, undefined)).toBe(false);
    expect(variantIsAcompte('normal', 'normal')).toBe(false);
  });
});
