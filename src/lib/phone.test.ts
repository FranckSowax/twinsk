import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@/config/countries';
import { formatPhone, normalizePhone, validatePhone } from './phone';

const GA = COUNTRIES.GA;
const CI = COUNTRIES.CI;

describe('téléphone — Gabon (comportement d’origine)', () => {
  it('chiffres seuls, « 00 » retiré, aucun indicatif ajouté', () => {
    expect(normalizePhone('07 42 75 60', GA)).toBe('07427560');
    expect(normalizePhone('+241 06 87 13 09', GA)).toBe('24106871309');
    expect(normalizePhone('00241 06871309', GA)).toBe('24106871309');
  });
  it('validation : 8 chiffres minimum, 15 maximum, pas de chiffre répété', () => {
    expect(validatePhone('07 42 75 60', GA)).toEqual({ ok: true, phone: '07427560' });
    expect(validatePhone('0742', GA)).toEqual({ ok: false, error: 'Un numéro WhatsApp valide est requis (8 chiffres minimum).' });
    expect(validatePhone('1234567890123456', GA)).toEqual({ ok: false, error: 'Numéro WhatsApp trop long.' });
    expect(validatePhone('11111111', GA)).toEqual({ ok: false, error: 'Numéro WhatsApp invalide.' });
  });
  it('affichage', () => {
    expect(formatPhone('24106871309', GA)).toBe('+241 06 87 13 09');
    expect(formatPhone('33612345678', GA)).toBe('+33612345678');
    expect(formatPhone('', GA)).toBe('');
  });
});

describe('téléphone — Côte d’Ivoire (décision D2 : indicatif ajouté)', () => {
  it('un numéro national à 10 chiffres reçoit 225 ; l’international est gardé', () => {
    expect(normalizePhone('07 07 07 07 07', CI)).toBe('2250707070707');
    expect(normalizePhone('+225 07 07 07 07 07', CI)).toBe('2250707070707');
    expect(normalizePhone('00225 0707070707', CI)).toBe('2250707070707');
    expect(normalizePhone('+33 6 12 34 56 78', CI)).toBe('33612345678');
  });
  it('validation : plan à 10 chiffres, préfixes 01 / 05 / 07 / 21 / 25 / 27', () => {
    expect(validatePhone('05 12 34 56 78', CI)).toEqual({ ok: true, phone: '2250512345678' });
    expect(validatePhone('+225 27 22 00 00 00', CI)).toEqual({ ok: true, phone: '2252722000000' });
    expect(validatePhone('07 42 75 60', CI).ok).toBe(false); // ancien format à 8 chiffres
    expect(validatePhone('+225 09 12 34 56 78', CI).ok).toBe(false); // préfixe inexistant
    expect(validatePhone('+241 06 87 13 09', CI)).toEqual({ ok: true, phone: '24106871309' }); // client gabonais
  });
  it('affichage', () => {
    expect(formatPhone('2250707070707', CI)).toBe('+225 07 07 07 07 07');
  });
});
