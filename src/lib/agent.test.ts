import { describe, it, expect } from 'vitest';
import {
  normalizePhone, signAgentToken, parseAgentToken,
  generateOtpCode, hashOtp, verifyOtpHash, otpRateLimited, canAdvanceTo,
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
  it('bloque a partir de 3 demandes recentes', () => {
    expect(otpRateLimited(2)).toBe(false);
    expect(otpRateLimited(3)).toBe(true);
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
