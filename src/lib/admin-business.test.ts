import { describe, expect, it } from 'vitest';
import { byListing, byTransport, monthlySeries, orderMargin, totalsInFcfa, type BusinessOrder } from './admin-business';

// Commande réelle du 18 sept. : marges 45 et 50 %, prix affichés = achat × (1 + marge).
const base: BusinessOrder = {
  id: 'o1',
  created_at: '2026-09-18T10:00:00Z',
  offer_id: 'off1',
  offer_title: 'Boulangerie',
  currency: 'XAF',
  transport_mode: 'mixed',
  items_total: 1_135_200,
  transport_cost: 1_073_460,
  discount: 0,
  commission: 0,
  lines: [
    { product_id: 'p1', quantity: 40, unit_price_cny: 27.55, margin_percent: 45 }, // achat 19
    { product_id: 'p2', quantity: 2, unit_price_cny: 124.5, margin_percent: 50 },  // achat 83
  ],
};

describe('marge d’une commande payée', () => {
  it('retrouve le prix d’achat depuis la marge et isole le transport', () => {
    const m = orderMargin(base);
    const achatCny = 19 * 40 + 83 * 2; // 926 CNY
    expect(m.cost).toBeCloseTo(achatCny * 91, 0);
    expect(m.revenue).toBe(1_135_200);
    expect(m.margin).toBeCloseTo(1_135_200 - achatCny * 91, 0);
    expect(m.marginRate).toBeGreaterThan(0.25);
    expect(m.transport).toBe(1_073_460); // jamais compté dans la marge
    expect(m.collected).toBe(1_135_200 + 1_073_460);
  });
  it('la remise réduit le chiffre d’affaires et la marge, pas le coût', () => {
    const m = orderMargin({ ...base, discount: 100_000 });
    expect(m.revenue).toBe(1_035_200);
    expect(m.margin).toBeCloseTo(orderMargin(base).margin - 100_000, 0);
  });
  it('la commission affiliée est déduite de la marge, pas du coût d’achat', () => {
    const sans = orderMargin(base);
    const avec = orderMargin({ ...base, commission: 50_000 });
    expect(avec.margin).toBeLessThan(sans.margin);
    expect(avec.commission).toBe(50_000);
    expect(avec.cost).toBeLessThan(sans.cost); // la commission sort du prix affiché
  });
  it('une ligne « acompte » (sur devis) n’entre ni dans le coût ni dans la marge', () => {
    const m = orderMargin({ ...base, lines: [...base.lines, { product_id: 'p3', quantity: 1, unit_price_cny: 0, margin_percent: 45, price_type: 'acompte' }] });
    expect(m.cost).toBeCloseTo(orderMargin(base).cost, 6);
  });
  it('marge inconnue (0 %) : prix d’achat = prix affiché, marge nulle sur la ligne', () => {
    const m = orderMargin({ ...base, items_total: 91_000, lines: [{ product_id: 'p1', quantity: 10, unit_price_cny: 100, margin_percent: 0 }] });
    expect(m.cost).toBe(91_000);
    expect(m.margin).toBe(0);
  });
});

describe('cumuls et séries', () => {
  const eur: BusinessOrder = { ...base, id: 'o2', currency: 'EUR', items_total: 200, transport_cost: 50, lines: [{ product_id: 'p1', quantity: 1, unit_price_cny: 770, margin_percent: 100 }] };
  it('convertit toutes les devises en FCFA pour le cumul', () => {
    const t = totalsInFcfa([base, eur]);
    expect(t.orders).toBe(2);
    // 200 € = 200 / (1/7.7) × 91 = 200 × 7.7 × 91
    expect(t.revenue).toBeCloseTo(1_135_200 + 200 * 7.7 * 91, 0);
    expect(t.averageOrder).toBeCloseTo(t.collected / 2, 6);
    expect(t.marginRate).toBeCloseTo(t.margin / t.revenue, 6);
  });
  it('série mensuelle : mois vides conservés, du plus ancien au plus récent', () => {
    const s = monthlySeries([base], 3, new Date('2026-09-21T00:00:00Z'));
    expect(s).toHaveLength(3);
    expect(s.map((b) => b.key)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(s[2].orders).toBe(1);
    expect(s[0].revenue).toBe(0);
  });
  it('répartition par listing et par transport', () => {
    expect(byListing([base, eur])[0].label).toBe('Boulangerie');
    expect(byTransport([base]).map((b) => b.label)).toEqual(['Fractionné']);
  });
});
