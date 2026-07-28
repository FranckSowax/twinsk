import { describe, it, expect } from 'vitest';
import { mergeVariantFills, maxPositive, numOrNull, strOrNull } from './review-variants';

describe('numOrNull / strOrNull', () => {
  it('numOrNull : vide/null → null, nombre → number', () => {
    expect(numOrNull('')).toBeNull();
    expect(numOrNull(null)).toBeNull();
    expect(numOrNull('2.5')).toBe(2.5);
    expect(numOrNull('abc')).toBeNull();
  });
  it('strOrNull : trim, vide → null', () => {
    expect(strOrNull('  60×40×85 ')).toBe('60×40×85');
    expect(strOrNull('   ')).toBeNull();
    expect(strOrNull(42)).toBeNull();
  });
});

describe('mergeVariantFills', () => {
  const base = () => [
    { name: 'Rouge', price: 10, image_url: 'a.jpg' },
    { name: 'Bleu', price: 12, image_url: 'b.jpg' },
  ];

  it('écrase poids/volume/dimensions par index, préserve les autres champs', () => {
    const out = mergeVariantFills(base(), [
      { index: 0, weight: '1.2', volume: '0.03', dimensions: '30×20×10' },
    ]);
    expect(out[0]).toEqual({ name: 'Rouge', price: 10, image_url: 'a.jpg', weight: 1.2, volume: 0.03, dimensions: '30×20×10' });
    expect(out[1]).toEqual({ name: 'Bleu', price: 12, image_url: 'b.jpg' }); // intacte
  });

  it('ne mute pas le tableau d’origine', () => {
    const src = base();
    mergeVariantFills(src, [{ index: 0, weight: '9' }]);
    expect(src[0]).toEqual({ name: 'Rouge', price: 10, image_url: 'a.jpg' });
  });

  it('ignore les index hors bornes ou invalides', () => {
    const out = mergeVariantFills(base(), [
      { index: 5, weight: '1' },
      { index: -1, weight: '1' },
      { weight: '1' },
    ]);
    expect(out).toEqual(base());
  });

  it('valeurs vides → null (efface)', () => {
    const out = mergeVariantFills(base(), [{ index: 1, weight: '', volume: '', dimensions: '' }]);
    expect(out[1]).toMatchObject({ weight: null, volume: null, dimensions: null });
  });
});

describe('maxPositive', () => {
  it('plus grande valeur positive, sinon null', () => {
    const vs = [{ weight: 2 }, { weight: 5 }, { weight: 0 }] as Record<string, unknown>[];
    expect(maxPositive(vs, 'weight')).toBe(5);
    expect(maxPositive([{ weight: 0 }] as Record<string, unknown>[], 'weight')).toBeNull();
  });
});
