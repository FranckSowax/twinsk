import { describe, expect, it } from 'vitest';
import { validateContact } from './contact-validation';

describe('validateContact', () => {
  it('accepte un nom et un numéro gabonais, avec ou sans indicatif', () => {
    expect(validateContact('Ruth Mba', '07 42 75 60')).toEqual({ ok: true, name: 'Ruth Mba', phone: '07427560' });
    expect(validateContact('  Franck   Sowax ', '+241 06 87 13 09')).toEqual({ ok: true, name: 'Franck Sowax', phone: '24106871309' });
    expect(validateContact('A. B', '00241 06871309')).toMatchObject({ ok: true, phone: '24106871309' });
  });
  it('refuse un nom vide ou sans lettres', () => {
    expect(validateContact('', '07427560').ok).toBe(false);
    expect(validateContact(' ', '07427560').ok).toBe(false);
    expect(validateContact('12', '07427560').ok).toBe(false);
  });
  it('refuse un numéro absent, trop court, trop long ou factice', () => {
    expect(validateContact('Ruth', '').ok).toBe(false);
    expect(validateContact('Ruth', '0742').ok).toBe(false);
    expect(validateContact('Ruth', '1234567890123456').ok).toBe(false);
    expect(validateContact('Ruth', '00000000').ok).toBe(false);
  });
});
