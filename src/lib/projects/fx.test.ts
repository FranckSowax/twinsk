import { describe, expect, it } from 'vitest';
import { cleanRates, currenciesNeeded, defaultRate, missingRates, rateOf, rebaseRates, toBase } from './fx';

describe('devises du devis projet', () => {
  it('conversion vers la devise principale ; 1 pour la base ; null sans taux', () => {
    expect(toBase(30, 'CNY', 'USD', { CNY: 0.14 })).toBe(4.2);
    expect(toBase(12, 'usd', 'USD', {})).toBe(12);
    expect(toBase(12, null, 'USD', {})).toBe(12);
    expect(toBase(8000, 'EUR', 'USD', { CNY: 0.14 })).toBeNull();
    expect(toBase(null, 'EUR', 'USD', { EUR: 1.08 })).toBeNull();
    expect(rateOf('EUR', 'USD', { EUR: 1.08 })).toBe(1.08);
  });
  it('table de taux nettoyée : majuscules, nombres positifs, base exclue', () => {
    expect(cleanRates({ cny: '0.14', EUR: 1.08, USD: 1, XAF: -1, ABCD: 2, GBP: 'x' }, 'USD')).toEqual({ CNY: 0.14, EUR: 1.08 });
    expect(cleanRates(null, 'USD')).toEqual({});
  });
  it('taux indicatifs cohérents entre bases', () => {
    expect(defaultRate('EUR', 'USD')).toBe(1.08);
    expect(defaultRate('USD', 'EUR')).toBeCloseTo(0.925926, 5);
    expect(defaultRate('CNY', 'XAF')).toBeCloseTo(84.848485, 3);
    expect(defaultRate('ZZZ', 'USD')).toBeNull();
  });
  it('changement de devise principale : taux recalculés, ancienne base ajoutée, repli indicatif', () => {
    // USD → EUR avec 1 EUR = 1,08 USD et 1 CNY = 0,14 USD
    const r = rebaseRates({ EUR: 1.08, CNY: 0.14 }, 'USD', 'EUR', ['GBP']);
    expect(r.USD).toBeCloseTo(0.925926, 5);
    expect(r.CNY).toBeCloseTo(0.12963, 4);
    expect(r.GBP).toBe(defaultRate('GBP', 'EUR'));
    expect(r.EUR).toBeUndefined();
    // Sans taux pour la nouvelle base : repli sur les repères
    expect(rebaseRates({}, 'EUR', 'USD')).toEqual({ EUR: 1.08 });
    expect(rebaseRates({ CNY: 0.14 }, 'USD', 'USD')).toEqual({ CNY: 0.14 });
  });
  it('devises nécessaires et taux manquants', () => {
    const lines = [{ price_currency: 'CNY', cost_currency: 'CNY' }, { price_currency: 'usd', cost_currency: 'EUR' }, { price_currency: null }];
    expect(currenciesNeeded(lines, 'USD')).toEqual(['CNY', 'EUR']);
    expect(missingRates(lines, 'USD', { CNY: 0.14 })).toEqual(['EUR']);
  });
});
