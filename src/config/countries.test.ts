import { describe, expect, it } from 'vitest';
import { COUNTRIES, COUNTRY, countryOf } from './countries';

describe('configuration par pays', () => {
  it('Gabon par défaut (NEXT_PUBLIC_COUNTRY absent)', () => {
    expect(COUNTRY.code).toBe('GA');
    expect(countryOf(undefined).code).toBe('GA');
  });
  it('lit le code sans tenir compte de la casse, refuse un code inconnu', () => {
    expect(countryOf('ci').code).toBe('CI');
    expect(() => countryOf('SN')).toThrow('Unknown country code: SN');
  });
  it('Gabon : valeurs actuelles conservées', () => {
    const g = COUNTRIES.GA;
    expect([g.brand, g.currency, g.timezone, g.phonePrefix, g.supportWhatsapp]).toEqual(['Oh My Gab', 'XAF', 'Africa/Libreville', '+241', '24107425560']);
    expect(g.freight).toEqual({ airRatePerKg: 13000, airBatteryRatePerKg: 18000, seaRatePerM3: 240000, seaRateFloorPerM3: 205000 });
    expect(g.modules.twinsk).toBe(true);
    expect(g.autoPrefixLocalPhone).toBe(false);
  });
  it('Côte d’Ivoire : XOF (UEMOA, pas XAF), UTC+0, +225, partie Twinsk absente', () => {
    const c = COUNTRIES.CI;
    expect([c.brand, c.currency, c.timezone, c.phonePrefix]).toEqual(['Oh My Cot', 'XOF', 'Africa/Abidjan', '+225']);
    expect(c.modules.twinsk).toBe(false);
    // Tarifs vers Abidjan (24 sept. 2026) : 12 000 / kg, 215 000 / m³ sans dégressivité.
    expect([c.freight.airRatePerKg, c.freight.seaRatePerM3, c.freight.seaRateFloorPerM3]).toEqual([12000, 215000, 215000]);
    expect(c.phoneRegex.test('0707070707')).toBe(true);
    expect(c.phoneRegex.test('0907070707')).toBe(false);
  });
  it('les deux pays déclarent les mêmes champs', () => {
    expect(Object.keys(COUNTRIES.CI).sort()).toEqual(Object.keys(COUNTRIES.GA).sort());
  });
});
