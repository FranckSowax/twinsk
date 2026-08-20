// Barèmes et valeurs par défaut du module Sourcing.
// Extraits de sourcing/cockpit_sourcing_assiette.html (tableaux TWIST, STATUTS, CUR
// et valeurs des champs de la section « Paramètres de calcul »).
// Les libellés français sont repris à l'identique : ce sont des garde-fous métier.

import type { CurrencyCode, QuoteStatus, SourcingParams, SourcingWeights, TwistLock } from './types';

/** Doit rester synchronisé avec le DEFAULT de sourcing_projects.params (migration 47). */
export const DEFAULT_PARAMS: SourcingParams = {
  qty: 5000,
  freight_rate_eur_m3: 180,
  insurance_pct: 0.4,
  duty_pct: 20,
  vat_pct: 18,
  fx: {
    EUR: 1,
    USD: 0.92,
    CNY: 0.128,
    THB: 0.026,
    VND: 0.000036,
    INR: 0.0105,
    MYR: 0.2,
    TWD: 0.029,
  },
};

/** Doit rester synchronisé avec le DEFAULT de sourcing_projects.weights (migration 47). */
export const DEFAULT_WEIGHTS: SourcingWeights = {
  twist: 30,
  conf: 20,
  solid: 15,
  cost: 15,
  moq: 10,
  lead: 10,
};

export const CURRENCIES: readonly CurrencyCode[] = [
  'EUR', 'USD', 'CNY', 'THB', 'VND', 'INR', 'MYR', 'TWD',
];

/**
 * Barème de faisabilité twist-lock. L'écart entre « déclaré » (55) et « avec photos
 * de moule » (80) est volontaire : une déclaration n'est pas une preuve.
 */
export const TWIST_SCALE: ReadonlyArray<{ value: TwistLock; label: string; score: number }> = [
  { value: 'refus', label: 'Refusé / non faisable', score: 0 },
  { value: 'etude', label: 'À étudier, sans engagement', score: 30 },
  { value: 'oui_decl', label: 'Oui, déclaré sans preuve', score: 55 },
  { value: 'oui_photo', label: 'Oui, avec photos de moule', score: 80 },
  { value: 'oui_ref', label: 'Oui, photos + référence client joignable', score: 100 },
];

/** Seuil à partir duquel la faisabilité est considérée comme prouvée (KPI § 6.5). */
export const TWIST_PROVEN_THRESHOLD = 80;

/** Libellés du cockpit HTML, dans l'ordre. La clé est la valeur stockée en base. */
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  relance: 'Relancé',
  a_repondu: 'A répondu',
  a_refuse: 'A refusé',
  ecarte: 'Écarté',
};

export const MOULD_OWNERSHIP_LABELS: Record<string, string> = {
  acheteur: 'Acheteur (Twinsk)',
  usine: 'Usine',
  partagee: 'Partagée',
};

export const VERDICT_LABELS: Record<string, string> = {
  green: 'Fiable',
  amber: 'Réserves',
  grey: 'DD à faire',
  red: 'Écarté',
};

/**
 * Avertissements affichés à côté des paramètres. Ce sont des mises en garde métier,
 * pas du remplissage : les reproduire tels quels dans l'interface.
 */
export const PARAM_WARNINGS = {
  dutyVat:
    'Droits et TVA à confirmer auprès du transitaire selon la position tarifaire.',
  fx: 'Taux de change à actualiser le jour de l’analyse des devis.',
} as const;

/**
 * Lignes du cahier des charges (section 1 du cockpit), dans l'ordre.
 * Chaque ligne porte une valeur et une tolérance / commentaire.
 */
export const SPEC_ROWS: readonly string[] = [
  'Diamètre hors tout',
  'Profondeur assiette',
  'Compartimentage',
  'Couvercle',
  'Mécanisme',
  'Matière',
  'Coloris',
  'Usages',
  'Conformités visées',
];

export interface SpecRow {
  label: string;
  value: string;
  tolerance: string;
}

/** Cahier des charges vierge : les libellés, sans valeur inventée. */
export function emptySpec(): { rows: SpecRow[] } {
  return { rows: SPEC_ROWS.map((label) => ({ label, value: '', tolerance: '' })) };
}

export interface MarketBlock {
  title: string;
  body: string;
}

/** Les 11 sections du cockpit, pour le sommaire latéral. */
export const COCKPIT_SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'projet', label: 'Projet' },
  { id: 'cahier-des-charges', label: '1. Cahier des charges' },
  { id: 'constat-marche', label: '2. Constat de marché' },
  { id: 'parametres', label: '3. Paramètres de calcul' },
  { id: 'consultation', label: '4. Consultation fournisseurs' },
  { id: 'grille-prix', label: '5. Grille de prix' },
  { id: 'comparatif', label: '6. Comparatif et scoring' },
  { id: 'tableau-de-bord', label: '7. Tableau de bord' },
  { id: 'journal', label: '8. Journal de contact' },
  { id: 'decision', label: '9. Décision et conditions' },
  { id: 'annexes', label: '10. Annexes visuelles' },
];
