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
