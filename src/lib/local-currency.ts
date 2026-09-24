// Devise locale du déploiement (franc CFA). Module sans dépendance, importable
// par le moteur de prix comme par les composants.

import { COUNTRY, type LocalCurrency } from '@/config/countries';

/** Code du franc CFA de ce pays : XAF (Gabon) ou XOF (Côte d'Ivoire). */
export const LOCAL_CURRENCY: LocalCurrency = COUNTRY.currency;

/** Franc CFA (XAF ou XOF) : même parité, même arrondi, même libellé « FCFA ». */
export function isLocalCurrency(c: unknown): c is LocalCurrency {
  return c === 'XAF' || c === 'XOF';
}
