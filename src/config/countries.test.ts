import { describe, expect, it } from 'vitest';
import { COUNTRIES, COUNTRY, countryOf } from './countries';
import { readFileSync } from 'node:fs';

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

describe('groupes WhatsApp et expéditeur (phase 3)', () => {
  it('Gabon : groupes et signature d’origine', () => {
    expect(COUNTRIES.GA.whatsappGroups).toEqual({ main: '120363408414253084@g.us', orders: '120363428402268041@g.us', search: '120363431660727284@g.us' });
    expect(COUNTRIES.GA.senderName).toBe('TWINSK');
  });
  it('Côte d’Ivoire : aucun groupe du Gabon par défaut, signature Oh My Cot', () => {
    expect(Object.values(COUNTRIES.CI.whatsappGroups).every((g) => g === '')).toBe(true);
    expect(COUNTRIES.CI.senderName).toBe('Oh My Cot');
  });
});

// Dimensions réelles d'un JPEG (segment SOF), sans dépendance.
function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('JPEG sans segment SOF');
}

describe('visuel du haut de /bio', () => {
  it.each(Object.values(COUNTRIES).map((c) => [c.code, c] as const))('%s : dimensions de la config = fichier', (_code, c) => {
    const buf = readFileSync(`public/brands/${c.code}/top-bio-web.jpg`);
    expect(jpegSize(buf)).toEqual(c.bioHero);
  });
});
