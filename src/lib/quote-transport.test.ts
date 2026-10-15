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

// Tableaux de Franck du 26 sept. 2026 : siège de 1,36 m³ (poids réel inférieur
// au poids volumétrique), 1 ou 2 sièges, livraison à Bordeaux.
describe('devis France — maritime + camion, train, avion au poids taxable', () => {
  const seat = (quantity: number) => [{ quantity, weight: 90, volume: 1.36, has_battery: false }];
  const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

  it('1 siège vers Bordeaux', () => {
    const t = computeQuoteTransport(seat(1), 'Bordeaux, France');
    expect(t.destinationCode).toBe('france');
    expect(round2(t.volumetricWeight)).toBe(227.12);
    expect(round2(t.chargeableWeight)).toBe(227.12);
    expect(round2(t.seaFreightNative)).toBe(516.8);
    expect(t.seaTruck).toMatchObject({ from: 'Paris', city: 'Bordeaux', pallets: 1, perPallet: 120, costNative: 120 });
    expect(round2(t.seaCostNative)).toBe(636.8);
    expect(round2(t.trainCostNative)).toBe(1544.42);
    expect(round2(t.airCostNative)).toBe(2271.2);
    expect(t.transitDays).toEqual({ sea: [45, 65], train: [23, 32], air: [5, 10] });
  });

  it('2 sièges vers Bordeaux : la palette de camion est partagée', () => {
    const t = computeQuoteTransport(seat(2), 'Bordeaux');
    expect(round2(t.seaFreightNative)).toBe(1033.6);
    expect(t.seaTruck?.pallets).toBe(1);
    expect(round2(t.seaCostNative)).toBe(1153.6);
    expect(round2(t.trainCostNative)).toBe(3088.83);
    expect(round2(t.airCostNative)).toBe(4542.4);
  });

  it('Paris : pas de camion', () => {
    const t = computeQuoteTransport(seat(1), 'Paris');
    expect(t.seaTruck).toBeNull();
    expect(round2(t.seaCostNative)).toBe(516.8);
  });

  it('poids réel supérieur au volumétrique : le poids réel est facturé', () => {
    const t = computeQuoteTransport([{ quantity: 1, weight: 300, volume: 1.36 }], 'france');
    expect(round2(t.chargeableWeight)).toBe(300);
    expect(round2(t.trainCostNative)).toBe(2040);
    expect(round2(t.airCostNative)).toBe(3000);
  });

  it('Gabon : ni train, ni poids volumétrique, ni camion (inchangé)', () => {
    const t = computeQuoteTransport(seat(1), 'gabon');
    expect(t.trainOffered).toBe(false);
    expect(t.trainCostNative).toBeNull();
    expect(t.volumetricWeight).toBeNull();
    expect(t.airCostNative).toBe(90 * 13000);
    expect(t.seaTruck).toBeNull();
    expect(t.transitDays).toEqual({});
  });
});

describe('choix du mode', () => {
  it('« au choix » prend le moins cher des modes proposés, train compris', async () => {
    const { pickQuoteTransportCny, quoteModesShown, normalizeQuoteTransportMode } = await import('./quote-transport');
    expect(pickQuoteTransportCny({ airCostCny: 300, seaCostCny: 100, trainCostCny: 200 }, 'both')).toBe(100);
    expect(pickQuoteTransportCny({ airCostCny: 300, seaCostCny: null, trainCostCny: 200 }, 'both')).toBe(200);
    expect(pickQuoteTransportCny({ airCostCny: 300, seaCostCny: 100, trainCostCny: 200 }, 'train')).toBe(200);
    expect(normalizeQuoteTransportMode('train')).toBe('train');
    expect(quoteModesShown('both', false)).toEqual({ air: true, sea: true, train: false });
    expect(quoteModesShown('both', true)).toEqual({ air: true, sea: true, train: true });
    expect(quoteModesShown('train', true)).toEqual({ air: false, sea: false, train: true });
  });
});

// Forfait maritime négocié, imposé sur un seul document (devis / colisage).
describe('forfait maritime imposé', () => {
  const chairsAndTables = [
    { quantity: 300, weight: null, volume: null, has_battery: false },
    { quantity: 70, weight: null, volume: 0.6075, has_battery: false },
  ];

  it('remplace la grille conteneur par le montant négocié', async () => {
    const { normalizeSeaOverride } = await import('./quote-transport');
    const override = normalizeSeaOverride({ amount: 7300, currency: 'USD', label: "Conteneur 40' HQ complet" });
    const t = computeQuoteTransport([{ quantity: 1, weight: 10, volume: 80, has_battery: false }], 'gabon', override);
    expect(t.seaMode).toBe('forfait');
    expect(t.seaCostNative).toBe(7300);
    expect(t.seaCostCurrency).toBe('USD');
    expect(t.seaModeLabel).toBe("Conteneur 40' HQ complet");
    expect(t.seaContainerCount).toBe(1);
  });

  it("s'applique même quand le volume d'un produit est inconnu", async () => {
    const { normalizeSeaOverride } = await import('./quote-transport');
    const sans = computeQuoteTransport(chairsAndTables, 'gabon');
    expect(sans.seaAvailable).toBe(false);
    expect(sans.seaCostCny).toBeNull();

    const avec = computeQuoteTransport(
      chairsAndTables,
      'gabon',
      normalizeSeaOverride({ amount: 7300, currency: 'USD' }),
    );
    expect(avec.seaAvailable).toBe(true);
    expect(avec.totalVolume).toBeNull();
    expect(avec.seaCostCny).toBeGreaterThan(0);
    expect(avec.seaModeLabel).toBe("Conteneur 40' HQ complet");
  });

  it('refuse un forfait vide, nul ou mal formé', async () => {
    const { normalizeSeaOverride } = await import('./quote-transport');
    expect(normalizeSeaOverride(null)).toBeNull();
    expect(normalizeSeaOverride({ amount: 0, currency: 'USD' })).toBeNull();
    expect(normalizeSeaOverride({ amount: -5, currency: 'USD' })).toBeNull();
    expect(normalizeSeaOverride({ amount: '7300' })?.currency).toBe('USD');
    expect(normalizeSeaOverride({ amount: 7300, currency: 'ZZZ' })?.currency).toBe('USD');
    expect(normalizeSeaOverride({ amount: 7300, containers: 2 })?.containers).toBe(2);
  });

  it('sans forfait, la grille conteneur 40′ standard reste appliquée', () => {
    const t = computeQuoteTransport([{ quantity: 1, weight: 10, volume: 40, has_battery: false }], 'gabon');
    expect(t.seaMode).toBe('container_40');
    expect(t.seaCostNative).toBe(7800);
  });
});
