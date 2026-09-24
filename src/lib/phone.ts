// Téléphone selon le pays du déploiement : normalisation (chiffres seuls,
// indicatif compris quand il est connu), validation et affichage.
// Gabon : comportement d'origine inchangé (pas d'ajout d'indicatif).
// Côte d'Ivoire : un numéro national à 10 chiffres reçoit l'indicatif 225 (décision D2).

import { COUNTRY, type CountryConfig } from '@/config/countries';

const digitsOf = (prefix: string) => prefix.replace(/\D/g, '');

/** Chiffres seuls, préfixe international « 00 » retiré ; indicatif ajouté aux numéros nationaux si le pays le prévoit. */
export function normalizePhone(input: string | null | undefined, country: CountryConfig = COUNTRY): string {
  let d = (input || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (country.autoPrefixLocalPhone && d.length === country.localPhoneDigits && country.phoneRegex.test(d)) {
    d = digitsOf(country.phonePrefix) + d;
  }
  return d;
}

export type PhoneCheck = { ok: true; phone: string } | { ok: false; error: string };

/** Valide un numéro WhatsApp ; renvoie la forme normalisée. */
export function validatePhone(input: string | null | undefined, country: CountryConfig = COUNTRY): PhoneCheck {
  const p = normalizePhone(input, country);
  if (country.autoPrefixLocalPhone) {
    const prefix = digitsOf(country.phonePrefix);
    const example = country.phoneExample.replace(`${country.phonePrefix} `, '');
    const invalid = `Un numéro WhatsApp valide est requis (${country.localPhoneDigits} chiffres, ex. ${example}).`;
    if (p.startsWith(prefix)) {
      if (!country.phoneRegex.test(p.slice(prefix.length))) return { ok: false, error: invalid };
    } else if (p.length < 10 || p.length > 15) {
      return { ok: false, error: p.length > 15 ? 'Numéro WhatsApp trop long.' : invalid };
    }
    if (/^(\d)\1+$/.test(p)) return { ok: false, error: 'Numéro WhatsApp invalide.' };
    return { ok: true, phone: p };
  }
  // Règle d'origine (Gabon).
  if (p.length < country.localPhoneDigits) return { ok: false, error: 'Un numéro WhatsApp valide est requis (8 chiffres minimum).' };
  if (p.length > 15) return { ok: false, error: 'Numéro WhatsApp trop long.' };
  if (/^(\d)\1+$/.test(p)) return { ok: false, error: 'Numéro WhatsApp invalide.' };
  return { ok: true, phone: p };
}

/** « 24106871309 » → « +241 06 87 13 09 » ; autre pays : « +33612345678 » sans regroupement. */
export function formatPhone(phone: string | null | undefined, country: CountryConfig = COUNTRY): string {
  const d = (phone || '').replace(/\D/g, '');
  if (!d) return '';
  const prefix = digitsOf(country.phonePrefix);
  if (d.startsWith(prefix)) return `+${prefix} ${d.slice(prefix.length).replace(/(\d{2})(?=\d)/g, '$1 ')}`;
  return `+${d}`;
}

/** Indicatif sans « + » (« 241 », « 225 »). */
export function phonePrefixDigits(country: CountryConfig = COUNTRY): string {
  return digitsOf(country.phonePrefix);
}
