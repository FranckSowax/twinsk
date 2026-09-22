import { describe, expect, it } from 'vitest';
import { cartKey, isOrderOpen, linesToCart } from './offer-cart-session';

describe('isOrderOpen — la commande mémorisée sert encore de panier', () => {
  it('reste ouverte tant que rien n’est payé', () => {
    expect(isOrderOpen({ payment_status: 'pending', status: 'new' })).toBe(true);
    expect(isOrderOpen({ payment_status: null, status: null })).toBe(true);
  });
  it('se ferme dès qu’un paiement est soumis ou validé', () => {
    expect(isOrderOpen({ payment_status: 'submitted', status: 'new' })).toBe(false);
    expect(isOrderOpen({ payment_status: 'paid', status: 'new' })).toBe(false);
    expect(isOrderOpen({ payment_status: 'pending', status: 'paid' })).toBe(false);
  });
  it('sans commande : pas de panier', () => {
    expect(isOrderOpen(null)).toBe(false);
    expect(isOrderOpen(undefined)).toBe(false);
  });
});

describe('linesToCart — lignes de commande → panier du listing', () => {
  it('une entrée par produit + variante, quantités cumulées', () => {
    const cart = linesToCart([
      { product_id: 'p1', variant_id: 'v1', quantity: 2 },
      { product_id: 'p1', variant_id: 'v1', quantity: 1 },
      { product_id: 'p1', variant_id: null, quantity: 1 },
      { product_id: 'p2', variant_id: undefined, quantity: 3 },
    ]);
    expect(cart[cartKey('p1', 'v1')]).toEqual({ productId: 'p1', variantId: 'v1', quantity: 3 });
    expect(cart[cartKey('p1', null)]).toEqual({ productId: 'p1', variantId: null, quantity: 1 });
    expect(cart[cartKey('p2', null)].quantity).toBe(3);
    expect(Object.keys(cart)).toHaveLength(3);
  });
  it('ignore les lignes sans produit ou à quantité nulle', () => {
    expect(linesToCart([{ product_id: null, quantity: 2 }, { product_id: 'p1', quantity: 0 }])).toEqual({});
  });
});
