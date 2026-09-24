// Moyens de paiement proposés au client, dérivés de COUNTRY.paymentProviders.
// Module pur, partagé client et serveur : la page commande affiche ces moyens,
// chaque route de paiement refuse un moyen qui n'est pas actif dans le pays.
//
// Gabon : e-Billing (maquette), Airtel Money (preuve manuelle), espèces.
// Côte d'Ivoire : mobile money via l'agrégateur PayDunya (Orange Money, MTN,
// Wave, Moov sur une seule page de paiement), espèces.

import { COUNTRY, type CountryConfig, type PaymentProviderId } from '@/config/countries';

/** Valeur écrite dans offer_orders.payment_method (historique : « airtel », « cash »). */
export type PaymentMethodId = 'ebilling' | 'airtel' | 'cash' | 'paydunya';

export type PaymentKind =
  /** Le client est redirigé vers une page de paiement externe. */
  | 'redirect'
  /** Le client paie hors ligne puis envoie une capture (validée par l'équipe). */
  | 'manual_proof'
  /** Réservation, encaissement en agence. */
  | 'cash';

export interface PaymentMethod {
  id: PaymentMethodId;
  /** Libellé du bouton de choix. */
  label: string;
  kind: PaymentKind;
  /** Route relative à /api/offer-public/{offre}/order/{commande}/. */
  endpoint: 'checkout' | 'pay-airtel' | 'pay-cash' | 'pay-online';
  /** Opérateurs couverts (agrégateur seulement), dans l'ordre de la config. */
  operators?: PaymentProviderId[];
}

/** Opérateurs passés par l'agrégateur PayDunya. */
const AGGREGATED: readonly PaymentProviderId[] = ['orange_money', 'mtn_momo', 'wave', 'moov_money'];

/** Libellés des opérateurs (texte d'aide sous le bouton mobile money). */
export const OPERATOR_LABELS: Record<PaymentProviderId, string> = {
  ebilling: 'eBilling',
  airtel_money: 'Airtel Money',
  cash: 'Espèces',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  wave: 'Wave',
  moov_money: 'Moov Money',
};

export function paymentMethodsFor(country: Pick<CountryConfig, 'paymentProviders'>): PaymentMethod[] {
  const out: PaymentMethod[] = [];
  const operators = country.paymentProviders.filter((p) => AGGREGATED.includes(p));
  for (const p of country.paymentProviders) {
    if (p === 'ebilling') out.push({ id: 'ebilling', label: 'eBilling', kind: 'redirect', endpoint: 'checkout' });
    else if (p === 'airtel_money') out.push({ id: 'airtel', label: 'Airtel', kind: 'manual_proof', endpoint: 'pay-airtel' });
    else if (p === 'cash') out.push({ id: 'cash', label: 'Cash', kind: 'cash', endpoint: 'pay-cash' });
    else if (AGGREGATED.includes(p) && !out.some((m) => m.id === 'paydunya')) {
      out.push({ id: 'paydunya', label: 'Mobile Money', kind: 'redirect', endpoint: 'pay-online', operators });
    }
  }
  return out;
}

/** Moyens actifs dans le pays du déploiement. */
export const PAYMENT_METHODS: PaymentMethod[] = paymentMethodsFor(COUNTRY);

export function isPaymentMethodEnabled(id: PaymentMethodId, methods: PaymentMethod[] = PAYMENT_METHODS): boolean {
  return methods.some((m) => m.id === id);
}

/**
 * Colonne des affiliés qui porte leur numéro d'encaissement (décision D5).
 * Là où Airtel Money est le moyen de reversement (Gabon), on garde la colonne
 * historique `airtel_number` ; ailleurs, la colonne générique `payout_number`
 * (migration 63).
 */
export const AFFILIATE_PAYOUT_COLUMN: 'airtel_number' | 'payout_number' =
  COUNTRY.paymentProviders.includes('airtel_money') ? 'airtel_number' : 'payout_number';

/** Numéro d'encaissement d'un affilié : colonne générique d'abord, historique ensuite. */
export function affiliatePayoutNumber(a: { payout_number?: string | null; airtel_number?: string | null } | null | undefined): string | null {
  return a?.payout_number?.trim() || a?.airtel_number?.trim() || null;
}
