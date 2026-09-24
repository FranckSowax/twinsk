import { describe, it, expect } from 'vitest';
import { COUNTRIES } from '@/config/countries';
import {
  normalizePhone, signAgentToken, parseAgentToken,
  generateOtpCode, hashOtp, verifyOtpHash, otpRateLimited, canAdvanceTo, phoneCandidates,
} from './agent';

describe('normalizePhone', () => {
  it('ne garde que les chiffres', () => {
    expect(normalizePhone('+241 06 12-34-56')).toBe('241061234 56'.replace(/\s/g, ''));
  });
  it('null/undefined -> chaine vide', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('agent token', () => {
  it('round-trip : parse(sign(id)) === id', () => {
    expect(parseAgentToken(signAgentToken('abc-123'))).toBe('abc-123');
  });
  it('jeton falsifie -> null', () => {
    const t = signAgentToken('abc-123');
    expect(parseAgentToken(t.slice(0, -2) + 'xx')).toBeNull();
  });
  it('jeton vide/malformé -> null', () => {
    expect(parseAgentToken(undefined)).toBeNull();
    expect(parseAgentToken('nodot')).toBeNull();
  });
});

describe('OTP', () => {
  it('genere 6 chiffres', () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
  it('hash + verif : le bon code valide, un autre non', () => {
    const h = hashOtp('123456');
    expect(verifyOtpHash('123456', h)).toBe(true);
    expect(verifyOtpHash('000000', h)).toBe(false);
  });
});

describe('otpRateLimited', () => {
  it('bloque a partir de 10 demandes recentes (10 OTP / 10 min)', () => {
    expect(otpRateLimited(9)).toBe(false);
    expect(otpRateLimited(10)).toBe(true);
  });
});

describe('canAdvanceTo', () => {
  it('avance d\'une etape autorisee', () => {
    expect(canAdvanceTo('paid', 'shipped')).toBe(true);
    expect(canAdvanceTo('shipped', 'at_agency')).toBe(true);
    expect(canAdvanceTo('at_agency', 'delivered')).toBe(true);
  });
  it('rejeu idempotent autorise (meme etape)', () => {
    expect(canAdvanceTo('shipped', 'shipped')).toBe(true);
  });
  it('saut d\'etape ou retour interdit', () => {
    expect(canAdvanceTo('paid', 'delivered')).toBe(false);
    expect(canAdvanceTo('at_agency', 'shipped')).toBe(false);
  });
});

describe('phoneCandidates', () => {
  const agentPhone = '24106871309';
  it.each(['24106871309', '+241 06 87 13 09', '06871309', '+241 6 87 13 09', '00241 06871309', '2416871309', '6871309'])(
    'retrouve %s',
    (typed) => expect(phoneCandidates(typed)).toContain(agentPhone),
  );
  it('ignore les saisies trop courtes', () => {
    expect(phoneCandidates('12')).toEqual([]);
    expect(phoneCandidates('')).toEqual([]);
  });
});

describe('phoneCandidates — Côte d’Ivoire (numéro national à 10 chiffres)', () => {
  it('formes avec et sans 225, le 0 initial conservé', () => {
    expect(phoneCandidates('07 07 07 07 07', COUNTRIES.CI).sort()).toEqual(['0707070707', '2250707070707']);
    expect(phoneCandidates('+225 07 07 07 07 07', COUNTRIES.CI).sort()).toEqual(['0707070707', '2250707070707']);
  });
  it('Gabon : candidats d’origine inchangés', () => {
    expect(phoneCandidates('06871309', COUNTRIES.GA)).toEqual(phoneCandidates('06871309'));
    expect(phoneCandidates('06871309', COUNTRIES.GA)).toContain('24106871309');
  });
});
