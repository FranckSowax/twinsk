import { describe, expect, it } from 'vitest';
import { computeQuoteTransport } from './quote-transport';

describe('devis — fret aérien scindé standard / batterie', () => {
  it('Gabon : 13 000 FCFA/kg standard + 18 000 FCFA/kg sur les seuls produits avec batterie', () => {
    const t = computeQuoteTransport(
      [
        { quantity: 2, weight: 1.5, volume: 0.01, has_battery: false },
        { quantity: 1, weight: 2, volume: 0.01, has_battery: true },
      ],
      'gabon',
    );
    expect(t.airRatePerKg).toBe(13000);
    expect(t.airBatteryRatePerKg).toBe(18000);
    expect(t.airWeightStd).toBe(3);
    expect(t.airWeightBattery).toBe(2);
    expect(t.airCostNative).toBe(3 * 13000 + 2 * 18000);
  });
});
