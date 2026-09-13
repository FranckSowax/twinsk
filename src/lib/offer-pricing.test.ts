import { describe, expect, it } from 'vitest';
import { SEA_RATE_FCFA_PER_M3, SEA_RATE_FLOOR_FCFA_PER_M3, computeOrderPricing, seaRateForVolume } from './offer-pricing';

const line = (volume: number, weight = 1) => ({ unit_price_cny: 100, quantity: 1, weight, volume, has_battery: false });

describe('seaRateForVolume — grille dégressive maritime', () => {
  it('plein tarif jusqu’à 2,5 m³', () => {
    expect(seaRateForVolume(0.5)).toBe(SEA_RATE_FCFA_PER_M3);
    expect(seaRateForVolume(2.5)).toBe(SEA_RATE_FCFA_PER_M3);
  });
  it('28 m³ = 5 000 000 FCFA, soit ≈ 178 571 FCFA / m³, et plancher au-delà', () => {
    expect(Math.round(seaRateForVolume(28) * 28)).toBe(5_000_000);
    expect(Math.round(seaRateForVolume(28))).toBe(178_571);
    expect(seaRateForVolume(40)).toBe(SEA_RATE_FLOOR_FCFA_PER_M3);
  });
  it('décroît entre 2,5 et 28 m³ avec un total toujours croissant', () => {
    let prevRate = Infinity;
    let prevTotal = 0;
    for (let v = 2.5; v <= 30; v += 0.5) {
      const r = seaRateForVolume(v);
      expect(r).toBeLessThanOrEqual(prevRate);
      expect(v * r).toBeGreaterThan(prevTotal);
      prevRate = r;
      prevTotal = v * r;
    }
    expect(Math.round(seaRateForVolume(10))).toBe(Math.round(240000 - (240000 - 5_000_000 / 28) * (7.5 / 25.5)));
  });
  it('computeOrderPricing applique la grille au volume total, et un tarif négocié plus bas prime', () => {
    const small = computeOrderPricing([line(1)]);
    expect(small.seaRate).toBe(SEA_RATE_FCFA_PER_M3);
    const big = computeOrderPricing([line(14), line(14)]);
    expect(Math.round(big.seaRate)).toBe(178_571);
    expect(Math.round(big.seaCost!)).toBe(5_000_000);
    const promo = computeOrderPricing([line(14), line(14)], { seaRate: 150_000 });
    expect(promo.seaRate).toBe(150_000);
    const promoTooHigh = computeOrderPricing([line(14), line(14)], { seaRate: 230_000 });
    expect(Math.round(promoTooHigh.seaRate)).toBe(178_571);
  });
});

describe('computeOrderPricing — devise de règlement euros (listing affiché en euros)', () => {
  const eurLine = (weight: number, volume: number, price = 77) => ({ unit_price_cny: price, quantity: 2, weight, volume, has_battery: false });
  it('convertit les articles en euros au centime et applique 10 €/kg et 390 €/m³ sans grille dégressive', () => {
    const r = computeOrderPricing([eurLine(1.5, 0.5)], { currency: 'EUR' });
    expect(r.currency).toBe('EUR');
    expect(r.itemsTotalFcfaRounded).toBe(20); // 77 CNY × 2 / 7,7 = 20 €
    expect(r.airRate).toBe(10);
    expect(r.seaRate).toBe(390);
    expect(r.airCost).toBe(30); // 3 kg × 10 €
    expect(r.seaCost).toBe(390); // 1 m³ × 390 €
    expect(r.airTotal).toBe(50);
    expect(r.seaTotal).toBe(410);
    const big = computeOrderPricing([eurLine(1, 14)], { currency: 'EUR' });
    expect(big.seaRate).toBe(390); // pas de dégressif en euros
  });
  it('convertit les codes promo (saisis en FCFA) dans la devise euros', () => {
    const r = computeOrderPricing([eurLine(1, 0.5)], { currency: 'EUR', discountFcfa: 91 * 7.7, seaRate: 91 * 7.7 * 100 });
    expect(r.discountFcfa).toBe(1); // 700,7 FCFA = 1 €
    expect(r.itemsNetFcfa).toBe(19);
    expect(r.seaRate).toBeCloseTo(100, 6); // 70 070 FCFA/m³ = 100 €/m³ < 390
  });
  it('en FCFA rien ne change : mêmes tarifs et arrondis qu’avant', () => {
    const r = computeOrderPricing([line(1)]);
    expect(r.currency).toBe('XAF');
    expect(r.airRate).toBe(13000);
    expect(r.seaRate).toBe(SEA_RATE_FCFA_PER_M3);
  });
});
