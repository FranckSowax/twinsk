// Utilitaires liés au pays du déploiement : devise locale, prix, dates.

import { COUNTRY, type CountryConfig } from '@/config/countries';
import { formatFCFA } from '@/lib/offer-pricing';

export { LOCAL_CURRENCY, isLocalCurrency } from '@/lib/local-currency';

/** Prix en devise locale, au rendu actuel (« 15 000 FCFA », arrondi au 100 supérieur). */
export function formatPrice(amount: number | null | undefined): string {
  return formatFCFA(amount);
}

/** Date et heure dans le fuseau du pays (ex. horodatages de l'admin). */
export function formatDateTime(
  date: string | number | Date,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  country: CountryConfig = COUNTRY,
): string {
  return new Date(date).toLocaleString('fr-FR', { timeZone: country.timezone, ...options });
}

/** Date seule dans le fuseau du pays. */
export function formatDate(
  date: string | number | Date,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
  country: CountryConfig = COUNTRY,
): string {
  return new Date(date).toLocaleDateString('fr-FR', { timeZone: country.timezone, ...options });
}

/**
 * Heure courante (0-23) dans le fuseau du pays. Lue par formatToParts : en
 * français, le format « heure seule » donne « 00 h », que Number() ne sait pas lire.
 */
export function hourInCountry(now: Date = new Date(), country: CountryConfig = COUNTRY): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: country.timezone, hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
    .find((p) => p.type === 'hour')?.value;
  return Number(h) % 24;
}

/** « 8 à 14 jours ». */
export function transitLabel(range: readonly [number, number]): string {
  return `${range[0]} à ${range[1]} jours`;
}
