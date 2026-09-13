import { describe, expect, it } from 'vitest';
import {
  pickQty,
  pickedTotalQty,
  pickedVariants,
  quoteLinesTotal,
  resolveQuoteLines,
  setVariantPick,
} from './variant-picks';

const product = {
  id: 'r1',
  title: 'Gourde isotherme',
  description: 'Inox',
  image_url: 'p.jpg',
  price: 20,
  quantity: 3,
  margin_percent: 10,
  moq: 50,
  weight: 0.3,
  volume: 0.002,
  dimensions: '10×10×25 cm',
  has_battery: false,
  client_variant_id: 'b',
  variants: [
    { id: 'a', name: 'Rouge 500 ml', price: 18, weight: 0.25 },
    { id: 'b', name: 'Bleu 750 ml', price: 22, volume: 0.003, image_url: 'b.jpg' },
    { id: 'c', name: '  ', price: 99 },
  ],
};

describe('pick_qty — lecture / écriture', () => {
  it('pickQty ignore les valeurs absentes, négatives ou non numériques', () => {
    expect(pickQty({ pick_qty: 4 })).toBe(4);
    expect(pickQty({ pick_qty: 2.7 })).toBe(2);
    expect(pickQty({ pick_qty: 0 })).toBe(0);
    expect(pickQty({ pick_qty: -3 })).toBe(0);
    expect(pickQty({})).toBe(0);
    expect(pickQty(null)).toBe(0);
  });

  it('setVariantPick fixe la quantité et retire la clé quand elle tombe à 0', () => {
    const v1 = setVariantPick(product.variants, 'a', 5);
    expect(v1[0]).toMatchObject({ id: 'a', name: 'Rouge 500 ml', price: 18, pick_qty: 5 });
    expect(v1[1]).toEqual(product.variants[1]);
    const v2 = setVariantPick(v1, 'a', 0);
    expect('pick_qty' in v2[0]).toBe(false);
    expect(pickedVariants(v2)).toHaveLength(0);
  });

  it('pickedTotalQty additionne les variantes retenues nommées', () => {
    let vs = setVariantPick(product.variants, 'a', 2);
    vs = setVariantPick(vs, 'b', 3);
    vs = setVariantPick(vs, 'c', 9); // sans nom → ignorée
    expect(pickedTotalQty(vs)).toBe(5);
  });
});

describe('resolveQuoteLines', () => {
  it('sans variante retenue : une ligne produit, variante principale = choix client', () => {
    const lines = resolveQuoteLines(product);
    expect(lines).toHaveLength(1);
    const l = lines[0];
    expect(l.variant_name).toBeNull();
    expect(l.quantity).toBe(3);
    expect(l.price).toBe(22); // prix de la variante principale (b)
    expect(l.variants.map((v) => [v.name, v.is_main])).toEqual([
      ['Rouge 500 ml', false],
      ['Bleu 750 ml', true],
    ]);
    expect(quoteLinesTotal(lines)).toBeCloseTo(22 * 1.1 * 3);
  });

  it('avec variantes retenues : une ligne par variante, repli sur le produit', () => {
    let vs = setVariantPick(product.variants, 'a', 2);
    vs = setVariantPick(vs, 'b', 4);
    const lines = resolveQuoteLines({ ...product, variants: vs });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      variant_name: 'Rouge 500 ml',
      quantity: 2,
      price: 18,
      weight: 0.25,
      volume: 0.002, // repli produit
      moq: 50,
      dimensions: '10×10×25 cm',
      image_url: 'p.jpg',
      variants: [],
    });
    expect(lines[1]).toMatchObject({
      variant_name: 'Bleu 750 ml',
      quantity: 4,
      price: 22,
      weight: 0.3, // repli produit
      volume: 0.003,
      image_url: 'b.jpg',
    });
    expect(lines[0].key).not.toBe(lines[1].key);
    expect(quoteLinesTotal(lines)).toBeCloseTo(18 * 1.1 * 2 + 22 * 1.1 * 4);
  });

  it('variante retenue sans prix : prix du produit ; produit sans prix : 0', () => {
    const vs = setVariantPick([{ id: 'x', name: 'Noir' }], 'x', 1);
    expect(resolveQuoteLines({ ...product, variants: vs })[0].price).toBe(20);
    expect(resolveQuoteLines({ ...product, price: null, variants: vs })[0].price).toBe(0);
  });
});
