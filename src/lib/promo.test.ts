import { describe, expect, it } from 'vitest';
import { computeOrderPricing } from './offer-pricing';
import {
  computeItemsDiscount,
  describePromo,
  evaluatePromo,
  normalizeCode,
  normalizePhone,
  pricingOptionsFor,
  type PromoCode,
} from './promo';

const NOW = new Date('2026-09-03T10:00:00Z');
const base: PromoCode = {
  id: 'p1',
  code: 'LANCEMENT',
  label: null,
  kind: 'items_percent',
  value: 10,
  starts_at: null,
  ends_at: null,
  max_uses: 100,
  max_uses_per_phone: 1,
  client_phone: null,
  min_items_fcfa: null,
  active: true,
  notes: null,
};
const ctx = { now: NOW, phone: '24107425560', itemsTotalFcfa: 50_000, totalUses: 0, phoneUses: 0 };

describe('normalisation', () => {
  it('code : majuscules, sans espaces ni tirets', () => {
    expect(normalizeCode(' lance-ment 10 ')).toBe('LANCEMENT10');
    expect(normalizeCode(null)).toBe('');
  });
  it('téléphone : chiffres seuls, sans 00', () => {
    expect(normalizePhone('+241 07 42 55 60')).toBe('24107425560');
    expect(normalizePhone('0024107425560')).toBe('24107425560');
  });
});

describe('evaluatePromo — règles anti-fraude', () => {
  it('accepte un code valide', () => {
    expect(evaluatePromo(base, ctx)).toEqual({ ok: true });
  });
  it('refuse un code inactif, pas encore valable ou expiré', () => {
    expect(evaluatePromo({ ...base, active: false }, ctx).ok).toBe(false);
    expect(evaluatePromo({ ...base, starts_at: '2026-09-04T00:00:00Z' }, ctx).ok).toBe(false);
    expect(evaluatePromo({ ...base, ends_at: '2026-09-02T00:00:00Z' }, ctx).ok).toBe(false);
  });
  it('« 100 premières commandes » : refuse à la 101ᵉ', () => {
    expect(evaluatePromo(base, { ...ctx, totalUses: 99 }).ok).toBe(true);
    expect(evaluatePromo(base, { ...ctx, totalUses: 100 }).ok).toBe(false);
  });
  it('un seul usage par numéro WhatsApp', () => {
    expect(evaluatePromo(base, { ...ctx, phoneUses: 1 }).ok).toBe(false);
    expect(evaluatePromo({ ...base, max_uses_per_phone: 3 }, { ...ctx, phoneUses: 2 }).ok).toBe(true);
  });
  it('code personnel : lié à un numéro', () => {
    const perso = { ...base, client_phone: '+241 07 42 55 60' };
    expect(evaluatePromo(perso, ctx).ok).toBe(true);
    expect(evaluatePromo(perso, { ...ctx, phone: '24106871309' }).ok).toBe(false);
    expect(evaluatePromo(perso, { ...ctx, phone: null }).ok).toBe(false);
  });
  it('minimum d’achat', () => {
    expect(evaluatePromo({ ...base, min_items_fcfa: 60_000 }, ctx).ok).toBe(false);
    expect(evaluatePromo({ ...base, min_items_fcfa: 50_000 }, ctx).ok).toBe(true);
  });
});

describe('remise articles', () => {
  it('pourcentage arrondi à la centaine inférieure, jamais plus que le total', () => {
    expect(computeItemsDiscount({ kind: 'items_percent', value: 10 }, 50_000)).toBe(5_000);
    expect(computeItemsDiscount({ kind: 'items_percent', value: 15 }, 12_345)).toBe(1_800);
    expect(computeItemsDiscount({ kind: 'items_percent', value: 150 }, 10_000)).toBe(10_000);
  });
  it('montant fixe plafonné au total ; codes transport = 0', () => {
    expect(computeItemsDiscount({ kind: 'items_fixed', value: 8_000 }, 50_000)).toBe(8_000);
    expect(computeItemsDiscount({ kind: 'items_fixed', value: 80_000 }, 50_000)).toBe(50_000);
    expect(computeItemsDiscount({ kind: 'air_rate', value: 9_000 }, 50_000)).toBe(0);
  });
});

describe('tarification avec promo', () => {
  const lines = [{ unit_price_cny: 100, quantity: 2, weight: 3, volume: 0.05, has_battery: false }];

  it('la remise porte sur les articles, jamais sur le transport', () => {
    const plain = computeOrderPricing(lines);
    const promo = computeOrderPricing(lines, { discountFcfa: 3_000 });
    expect(promo.discountFcfa).toBe(3_000);
    expect(promo.itemsNetFcfa).toBe(plain.itemsTotalFcfaRounded - 3_000);
    expect(promo.airCost).toBe(plain.airCost);
    expect(promo.airTotal).toBe(plain.airTotal! - 3_000);
  });

  it('un tarif transport négocié remplace le tarif normal, sans jamais le dépasser', () => {
    const cheaper = computeOrderPricing(lines, { airRate: 9_000 });
    expect(cheaper.airRate).toBe(9_000);
    expect(cheaper.airCost).toBe(6 * 9_000); // 3 kg × 2 unités
    const pricier = computeOrderPricing(lines, { airRate: 99_000 });
    expect(pricier.airRate).toBe(13_000);
    const sea = computeOrderPricing(lines, { seaRate: 200_000 });
    expect(sea.seaCost).toBeCloseTo(0.1 * 200_000, 6); // 0,05 m³ × 2 unités
  });

  it('pricingOptionsFor lit la promo persistée sur la commande', () => {
    expect(pricingOptionsFor({ promo_kind: 'sea_rate', promo_rate: 200_000, promo_discount_fcfa: 0 })).toEqual({
      airRate: null,
      seaRate: 200_000,
      discountFcfa: 0,
    });
    expect(pricingOptionsFor({ promo_kind: 'items_percent', promo_rate: null, promo_discount_fcfa: 2_500 }).discountFcfa).toBe(2_500);
  });

  it('describePromo', () => {
    expect(describePromo({ kind: 'items_percent', value: 10 })).toBe('−10 % sur les articles');
    expect(describePromo({ kind: 'sea_rate', value: 200000 })).toBe('Maritime à 200 000 FCFA / m³');
  });
});
