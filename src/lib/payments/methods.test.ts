import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@/config/countries';
import { affiliatePayoutNumber, isPaymentMethodEnabled, paymentMethodsFor } from './methods';

describe('paymentMethodsFor', () => {
  it('Gabon : e-Billing, Airtel, Cash — même ordre et mêmes libellés qu’avant', () => {
    const m = paymentMethodsFor(COUNTRIES.GA);
    expect(m.map((x) => [x.id, x.label, x.endpoint])).toEqual([
      ['ebilling', 'eBilling', 'checkout'],
      ['airtel', 'Airtel', 'pay-airtel'],
      ['cash', 'Cash', 'pay-cash'],
    ]);
  });

  it('Côte d’Ivoire : un seul bouton mobile money (4 opérateurs) + espèces', () => {
    const m = paymentMethodsFor(COUNTRIES.CI);
    expect(m.map((x) => x.id)).toEqual(['paydunya', 'cash']);
    expect(m[0].operators).toEqual(['orange_money', 'mtn_momo', 'wave', 'moov_money']);
    expect(isPaymentMethodEnabled('airtel', m)).toBe(false);
    expect(isPaymentMethodEnabled('ebilling', m)).toBe(false);
  });
});

describe('affiliatePayoutNumber', () => {
  it('préfère la colonne générique, retombe sur airtel_number', () => {
    expect(affiliatePayoutNumber({ payout_number: '0707070707', airtel_number: '074' })).toBe('0707070707');
    expect(affiliatePayoutNumber({ airtel_number: '074' })).toBe('074');
    expect(affiliatePayoutNumber({ payout_number: '  ', airtel_number: null })).toBeNull();
    expect(affiliatePayoutNumber(null)).toBeNull();
  });
});
