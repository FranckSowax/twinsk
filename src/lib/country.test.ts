import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@/config/countries';
import { formatDateTime, formatPrice, hourInCountry, isLocalCurrency, transitLabel } from './country';

describe('utilitaires pays', () => {
  it('devise locale : XAF et XOF sont tous deux le franc CFA', () => {
    expect(isLocalCurrency('XAF')).toBe(true);
    expect(isLocalCurrency('XOF')).toBe(true);
    expect(isLocalCurrency('EUR')).toBe(false);
  });
  it('prix : rendu actuel conservé (arrondi au 100 supérieur, « FCFA »)', () => {
    expect(formatPrice(14961).replace(/\s/g, ' ')).toBe('15 000 FCFA');
    expect(formatPrice(null)).toBe('Sur devis');
  });
  it('heure et dates dans le fuseau du pays (Libreville UTC+1, Abidjan UTC+0)', () => {
    const t = new Date('2026-09-24T23:30:00Z');
    expect(hourInCountry(t, COUNTRIES.GA)).toBe(0);
    expect(hourInCountry(t, COUNTRIES.CI)).toBe(23);
    expect(formatDateTime(t, { day: '2-digit', hour: '2-digit', minute: '2-digit' }, COUNTRIES.GA)).toBe('25 00:30');
    expect(formatDateTime(t, { day: '2-digit', hour: '2-digit', minute: '2-digit' }, COUNTRIES.CI)).toBe('24 23:30');
  });
  it('délais', () => {
    expect(transitLabel(COUNTRIES.GA.transit.air)).toBe('8 à 14 jours');
  });
});
