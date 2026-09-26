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
  /**
   * Poids volumétrique (kg par m³) : le fret aérien et ferroviaire est facturé
   * au poids taxable = max(poids réel, volume × ce facteur). Absent : poids réel.
   */
  volumetric_kg_per_cbm?: number;
  /** Ferroviaire Chine → destination, livré à l'adresse : prix par kg taxable. Absent : pas de train. */
  train_rate_per_kg?: number;
  /**
   * Maritime livré au hub (ex. Paris), puis camion jusqu'à certaines villes,
   * facturé à la palette et partagé entre les produits d'une même palette.
   */
  sea_truck?: {
    from: string;
    /** Volume chargé sur une palette (m³). */
    pallet_capacity_cbm: number;
    legs: { city: string; match: RegExp; per_pallet: number }[];
  };
  /** Délais porte à porte indicatifs, en jours [min, max]. */
  transit_days?: Partial<Record<'air' | 'sea' | 'train', [number, number]>>;
}

export const DESTINATIONS: Record<DestinationCode, Destination> = {
  gabon: {
    code: 'gabon',
    label: 'Gabon (Libreville)',
    hub: 'LBV',
    currency: 'XAF',
    air_rate_per_kg: 13_000,
    air_battery_rate_per_kg: 18_000,
    sea_rate_per_cbm: 240_000,
  },
  // Tarifs France communiqués par Franck le 26 sept. 2026 (devis sièges) :
  // maritime 380 €/m³ jusqu'à Paris (+ camion 120 €/palette vers Bordeaux),
  // train 6,80 €/kg taxable, avion 10 €/kg taxable, livrés à l'adresse ;
  // poids taxable = max(poids réel, volume × 167 kg/m³).
  france: {
    code: 'france',
    label: 'France (Paris CDG)',
    hub: 'CDG',
    currency: 'EUR',
    air_rate_per_kg: 10,
    // Pas de tarif batterie distinct communique : memes 10 EUR/kg.
    air_battery_rate_per_kg: 10,
    sea_rate_per_cbm: 380,
    volumetric_kg_per_cbm: 167,
    train_rate_per_kg: 6.8,
    sea_truck: {
      from: 'Paris',
      // Hypothèse : 2 sièges (2,72 m³) tiennent sur une palette ; au-delà de
      // 3 m³, une palette de plus. TODO(franck) : capacité réelle d'une palette.
      pallet_capacity_cbm: 3,
      legs: [{ city: 'Bordeaux', match: /bordeaux/i, per_pallet: 120 }],
    },
    transit_days: { sea: [45, 65], train: [23, 32], air: [5, 10] },
  },
};

export const DEFAULT_DESTINATION: DestinationCode = 'gabon';

// --- Optimisation conteneur maritime (regle universelle, indep. destination)
// V < 20 CBM             -> groupage au CBM (tarifs destination)
// 20 <= V <= 28 CBM      -> conteneur 20' a prix fixe
// 28 < V <= 72 CBM       -> conteneur 40' a prix fixe
// V > 72 CBM             -> N x conteneurs 40' (ceil(V/72))
export const GROUPAGE_MAX_CBM = 20;

export const CONTAINER_20 = {
  capacityCbm: 28,
  cost: 5500,
  currency: 'EUR' as CurrencyCode,
  label: "Conteneur 20' complet",
};

export const CONTAINER_40 = {
  capacityCbm: 72,
  cost: 7800,
  currency: 'USD' as CurrencyCode,
  label: "Conteneur 40' complet",
};

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
  if (/(france|paris|cdg|bordeaux|lyon|marseille|toulouse|nantes|lille|nice|strasbourg|montpellier|rennes)/.test(lower)) return DESTINATIONS.france;
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
