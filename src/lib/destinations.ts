// Catalogue des destinations Twinsk + tarifs transport (devise native du pays).
// Sert au calcul du devis et de l offre publique.

import type { CurrencyCode } from './utils/formatCurrency';

export type DestinationCode = 'gabon' | 'france';

export interface Destination {
  code: DestinationCode;
  label: string;
  hub: string;
  /** Devise native pour exprimer les tarifs transport. */
  currency: CurrencyCode;
  /** Aérien standard : prix par kg en devise native. */
  air_rate_per_kg: number;
  /** Aérien batterie (lithium) : prix par kg en devise native. */
  air_battery_rate_per_kg: number;
  /** Maritime (groupage) : prix par m³ en devise native. */
  sea_rate_per_cbm: number;
}

export const DESTINATIONS: Record<DestinationCode, Destination> = {
  gabon: {
    code: 'gabon',
    label: 'Gabon (Libreville)',
    hub: 'LBV',
    currency: 'XAF',
    air_rate_per_kg: 13_000,
    air_battery_rate_per_kg: 18_000,
    sea_rate_per_cbm: 260_000,
  },
  france: {
    code: 'france',
    label: 'France (Paris CDG)',
    hub: 'CDG',
    currency: 'EUR',
    air_rate_per_kg: 10,
    // Pas de tarif batterie distinct communique : memes 10 EUR/kg.
    air_battery_rate_per_kg: 10,
    sea_rate_per_cbm: 380,
  },
};

export const DEFAULT_DESTINATION: DestinationCode = 'gabon';

export const DESTINATION_LIST: Destination[] = Object.values(DESTINATIONS);

/**
 * Resoud une chaine vers une Destination. Tolerant aux anciennes valeurs
 * libres (eg "Libreville" -> Gabon). Fallback : DEFAULT_DESTINATION.
 */
export function resolveDestination(code: string | null | undefined): Destination {
  if (!code) return DESTINATIONS[DEFAULT_DESTINATION];
  const lower = code.toLowerCase().trim();
  if (lower in DESTINATIONS) return DESTINATIONS[lower as DestinationCode];
  if (/(gabon|libreville|lbv)/.test(lower)) return DESTINATIONS.gabon;
  if (/(france|paris|cdg)/.test(lower)) return DESTINATIONS.france;
  return DESTINATIONS[DEFAULT_DESTINATION];
}

/** Libelle a afficher (resilient aux anciennes destinations en texte libre). */
export function destinationLabel(code: string | null | undefined): string {
  if (!code) return DESTINATIONS[DEFAULT_DESTINATION].label;
  const lower = code.toLowerCase().trim();
  if (lower in DESTINATIONS) return DESTINATIONS[lower as DestinationCode].label;
  // Valeur libre legacy : on l affiche telle quelle.
  return code;
}
