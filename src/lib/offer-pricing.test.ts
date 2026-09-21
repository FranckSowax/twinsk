import { describe, expect, it } from 'vitest';
import { SEA_RATE_FCFA_PER_M3, SEA_RATE_FLOOR_FCFA_PER_M3, computeOrderPricing, grandTotalFor, seaRateForVolume, transportCostFor } from './offer-pricing';

const line = (volume: number, weight = 1) => ({ unit_price_cny: 100, quantity: 1, weight, volume, has_battery: false });

describe('seaRateForVolume — grille dégressive maritime (21 sept. 2026)', () => {
  it('plein tarif jusqu’à 3 m³', () => {
    expect(seaRateForVolume(0.5)).toBe(SEA_RATE_FCFA_PER_M3);
    expect(seaRateForVolume(3)).toBe(SEA_RATE_FCFA_PER_M3);
  });
  it('20 m³ = 205 000 FCFA / m³, et plancher indicatif au-delà', () => {
    expect(seaRateForVolume(20)).toBe(SEA_RATE_FLOOR_FCFA_PER_M3);
    expect(SEA_RATE_FLOOR_FCFA_PER_M3).toBe(205000);
    expect(seaRateForVolume(40)).toBe(SEA_RATE_FLOOR_FCFA_PER_M3);
  });
  it('décroît entre 3 et 20 m³ avec un total toujours croissant', () => {
    let prevRate = Infinity;
    let prevTotal = 0;
    for (let v = 3; v <= 20; v += 0.5) {
      const r = seaRateForVolume(v);
      expect(r).toBeLessThanOrEqual(prevRate);
      expect(v * r).toBeGreaterThan(prevTotal);
      prevRate = r;
      prevTotal = v * r;
    }
    expect(Math.round(seaRateForVolume(11.5))).toBe(222500); // mi-chemin entre 240 000 et 205 000
  });
  it('computeOrderPricing applique la grille au volume total, et un tarif négocié plus bas prime', () => {
    const small = computeOrderPricing([line(1)]);
    expect(small.seaRate).toBe(SEA_RATE_FCFA_PER_M3);
    const big = computeOrderPricing([line(10), line(10)]);
    expect(big.seaRate).toBe(205000);
    expect(big.seaCost).toBe(4_100_000);
    expect(big.seaOverLimit).toBe(false);
    const promo = computeOrderPricing([line(10), line(10)], { seaRate: 150_000 });
    expect(promo.seaRate).toBe(150_000);
    const promoTooHigh = computeOrderPricing([line(10), line(10)], { seaRate: 230_000 });
    expect(promoTooHigh.seaRate).toBe(205000);
  });
  it('au-delà de 20 m³ : conteneur dédié sur devis, plus de prix maritime automatique', () => {
    const r = computeOrderPricing([{ ...line(1), quantity: 28 }]); // 28 unités de 1 m³ (chacune accepte l'avion)
    expect(r.seaOverLimit).toBe(true);
    expect(r.seaAvailable).toBe(false);
    expect(r.seaCost).toBeNull();
    expect(r.seaTotal).toBeNull();
    expect(r.totalVolume).toBe(28);
    // l'aérien reste proposé
    expect(r.airAvailable).toBe(true);
  });
  it('transport fractionné : la part bateau au-delà de 20 m³ rend le mode indisponible', () => {
    const r = computeOrderPricing([{ ...line(1), quantity: 30, air_qty: 5 }]);
    expect(r.mixed!.seaUnits).toBe(25);
    expect(r.mixed!.seaOverLimit).toBe(true);
    expect(r.mixed!.available).toBe(false);
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

describe('fret aérien scindé standard / batterie (18 sept. 2026)', () => {
  const std = { unit_price_cny: 10, quantity: 2, weight: 1.5, volume: 0.01, has_battery: false }; // 3 kg
  const bat = { unit_price_cny: 10, quantity: 1, weight: 2, volume: 0.01, has_battery: true }; // 2 kg
  it('les kilos sans batterie restent à 13 000, seuls les kilos batterie passent à 18 000', () => {
    const r = computeOrderPricing([std, bat]);
    expect(r.hasBattery).toBe(true);
    expect(r.airRate).toBe(13000);
    expect(r.airBatteryRate).toBe(18000);
    expect(r.airWeightStd).toBe(3);
    expect(r.airWeightBattery).toBe(2);
    expect(r.airCostStd).toBe(39000);
    expect(r.airCostBattery).toBe(36000);
    expect(r.airCost).toBe(75000);
  });
  it('sans batterie : tout au tarif standard ; que des batteries : tout au tarif batterie', () => {
    expect(computeOrderPricing([std]).airCost).toBe(39000);
    const only = computeOrderPricing([bat]);
    expect(only.airCost).toBe(36000);
    expect(only.airWeightStd).toBe(0);
  });
  it('un tarif promo négocié s’applique aux deux parts, jamais au-dessus des tarifs normaux', () => {
    const r = computeOrderPricing([std, bat], { airRate: 12000 });
    expect(r.airRate).toBe(12000);
    expect(r.airBatteryRate).toBe(12000);
    expect(r.airCost).toBe(60000);
  });
});

describe('transport fractionné (avion + bateau) — 18 sept. 2026', () => {
  const l = (quantity: number, air_qty: number | null, weight = 1, volume = 0.05, has_battery = false) => ({ unit_price_cny: 10, quantity, weight, volume, has_battery, air_qty });
  it('sans répartition, mixed est null ; avec répartition, chaque part est chiffrée à son tarif', () => {
    expect(computeOrderPricing([l(30, null)]).mixed).toBeNull();
    const r = computeOrderPricing([l(30, 10)]);
    expect(r.mixed).not.toBeNull();
    expect(r.mixed!.airUnits).toBe(10);
    expect(r.mixed!.seaUnits).toBe(20);
    expect(r.mixed!.airCost).toBe(10 * 1 * 13000);
    expect(r.mixed!.seaCost).toBe(20 * 0.05 * 240000); // 1 m³ → plein tarif
    expect(r.mixed!.cost).toBe(130000 + 240000);
    expect(r.mixed!.total).toBe(r.itemsNetFcfa + 370000);
    expect(transportCostFor(r, 'mixed')).toBe(370000);
    expect(grandTotalFor(r, 'mixed')).toBe(r.mixed!.total);
  });
  it('tout en avion ou tout en bateau via la répartition, batterie scindée sur la part avion', () => {
    const allAir = computeOrderPricing([l(5, 5), l(2, 2, 2, 0.01, true)]);
    expect(allAir.mixed!.seaUnits).toBe(0);
    expect(allAir.mixed!.airCostBattery).toBe(4 * 18000);
    expect(allAir.mixed!.cost).toBe(5 * 13000 + 4 * 18000);
    const allSea = computeOrderPricing([l(5, 0)]);
    expect(allSea.mixed!.airUnits).toBe(0);
    expect(allSea.mixed!.cost).toBe(allSea.seaCost);
  });
  it('indisponible si un poids manque côté avion ou un volume côté bateau', () => {
    expect(computeOrderPricing([l(4, 2, 1, null as unknown as number)]).mixed!.available).toBe(false);
    expect(computeOrderPricing([l(4, 4, 1, null as unknown as number)]).mixed!.available).toBe(true);
    expect(computeOrderPricing([l(4, 2, null as unknown as number, 0.05)]).mixed!.available).toBe(false);
  });
});

describe('article trop volumineux pour l’avion (> 1,5 m³ l’unité) — 21 sept. 2026', () => {
  const sofa = { unit_price_cny: 900, quantity: 1, weight: 45, volume: 1.8, has_battery: false };
  const lamp = { unit_price_cny: 40, quantity: 4, weight: 1, volume: 0.01, has_battery: false };
  it('un seul article de plus de 1,5 m³ : pas d’aérien, aucun prix, le maritime reste proposé', () => {
    const r = computeOrderPricing([sofa]);
    expect(r.airOversize).toBe(true);
    expect(r.airAvailable).toBe(false);
    expect(r.airCost).toBeNull();
    expect(r.airTotal).toBeNull();
    expect(r.seaAvailable).toBe(true);
    expect(r.totalUnits).toBe(1);
  });
  it('1,5 m³ pile reste accepté en avion ; volume inconnu ne bloque pas', () => {
    expect(computeOrderPricing([{ ...sofa, volume: 1.5 }]).airOversize).toBe(false);
    expect(computeOrderPricing([{ ...sofa, volume: null }]).airOversize).toBe(false);
  });
  it('fractionné : l’article trop volumineux part toujours en bateau, le reste peut prendre l’avion', () => {
    const r = computeOrderPricing([{ ...sofa, air_qty: 1 }, { ...lamp, air_qty: 4 }]);
    expect(r.airOversize).toBe(true);
    expect(r.totalUnits).toBe(5);
    expect(r.mixed!.airUnits).toBe(4); // les lampes
    expect(r.mixed!.seaUnits).toBe(1); // le canapé, malgré air_qty = 1
    expect(r.mixed!.available).toBe(true);
    expect(r.mixed!.airCost).toBe(4 * 13000);
  });
});
