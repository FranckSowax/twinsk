// Transport pricing for the quote PDF. Tarifs dependent de la destination
// (see src/lib/destinations.ts). On retourne le cout dans la devise native
// du pays + son equivalent CNY pour faciliter le calcul total cote PDF.

import {
  CONTAINER_20,
  CONTAINER_40,
  DEFAULT_DESTINATION,
  GROUPAGE_MAX_CBM,
  resolveDestination,
  type DestinationCode,
} from './destinations';
import { FX_RATES, type CurrencyCode } from './utils/formatCurrency';

export type SeaMode = 'groupage' | 'container_20' | 'container_40' | 'multi_40';

export interface QuoteLine {
  quantity: number;
  weight: number | null; // kg unitaire
  volume: number | null; // m³ unitaire
  has_battery?: boolean | null;
}

export interface QuoteTransportSummary {
  destinationCode: DestinationCode;
  destinationLabel: string;
  hub: string;
  nativeCurrency: CurrencyCode;
  totalWeight: number | null;
  totalVolume: number | null;
  hasBattery: boolean;
  airAvailable: boolean;
  seaAvailable: boolean;
  /** Tarif aerien applique (par kg, en devise native). */
  airRatePerKg: number;
  /** Tarif maritime (par m³, en devise native) — utilise uniquement en groupage. */
  seaRatePerCbm: number;
  /** Cout aerien total dans la devise native. */
  airCostNative: number | null;
  /**
   * Cout maritime total dans la devise native du mode choisi :
   * - groupage   -> devise native du pays (FCFA/EUR)
   * - container  -> devise native du conteneur (EUR pour 20', USD pour 40')
   */
  seaCostNative: number | null;
  /** Devise native du cout maritime (peut differer de la devise du pays). */
  seaCostCurrency: CurrencyCode;
  /** Mode maritime choisi en fonction du CBM total. */
  seaMode: SeaMode | null;
  /** Nombre de conteneurs 40' (pour multi_40). 1 sinon, null si pas applicable. */
  seaContainerCount: number;
  /** Libelle humain du mode (ex: "Groupage maritime", "Conteneur 40' complet (x2)"). */
  seaModeLabel: string | null;
  /** Cout aerien total exprime en CNY (pour additionner au sous-total devis). */
  airCostCny: number | null;
  /** Cout maritime total exprime en CNY. */
  seaCostCny: number | null;
}

function nativeToCny(amount: number, native: CurrencyCode): number {
  // FX_RATES[X] = "1 CNY -> X". Pour passer native -> CNY : amount / rate.
  const rate = FX_RATES[native];
  if (!rate) return 0;
  return amount / rate;
}

export function computeQuoteTransport(
  lines: QuoteLine[],
  destinationCode: string | null | undefined = DEFAULT_DESTINATION,
): QuoteTransportSummary {
  const dest = resolveDestination(destinationCode);
  let totalWeight = 0;
  let totalVolume = 0;
  let weightKnown = true;
  let volumeKnown = true;
  let hasBattery = false;

  for (const l of lines) {
    if (l.has_battery) hasBattery = true;
    if (l.weight != null) totalWeight += l.weight * l.quantity;
    else weightKnown = false;
    if (l.volume != null) totalVolume += l.volume * l.quantity;
    else volumeKnown = false;
  }

  const airAvailable = weightKnown && totalWeight > 0;
  const seaAvailable = volumeKnown && totalVolume > 0;
  const airRatePerKg = hasBattery
    ? dest.air_battery_rate_per_kg
    : dest.air_rate_per_kg;
  const seaRatePerCbm = dest.sea_rate_per_cbm;

  const airCostNative = airAvailable ? totalWeight * airRatePerKg : null;

  // Maritime : regle d optimisation conteneur.
  // < 20 CBM        -> groupage (tarif destination)
  // <= 28 CBM       -> conteneur 20' (5500 EUR fixe)
  // <= 72 CBM       -> conteneur 40' (7800 USD fixe)
  // > 72 CBM        -> ceil(V/72) conteneurs 40'
  let seaCostNative: number | null = null;
  let seaCostCurrency: CurrencyCode = dest.currency;
  let seaMode: SeaMode | null = null;
  let seaContainerCount = 0;
  let seaModeLabel: string | null = null;

  if (seaAvailable) {
    if (totalVolume < GROUPAGE_MAX_CBM) {
      seaMode = 'groupage';
      seaContainerCount = 0;
      seaCostNative = totalVolume * seaRatePerCbm;
      seaCostCurrency = dest.currency;
      seaModeLabel = 'Groupage maritime';
    } else if (totalVolume <= CONTAINER_20.capacityCbm) {
      seaMode = 'container_20';
      seaContainerCount = 1;
      seaCostNative = CONTAINER_20.cost;
      seaCostCurrency = CONTAINER_20.currency;
      seaModeLabel = CONTAINER_20.label;
    } else if (totalVolume <= CONTAINER_40.capacityCbm) {
      seaMode = 'container_40';
      seaContainerCount = 1;
      seaCostNative = CONTAINER_40.cost;
      seaCostCurrency = CONTAINER_40.currency;
      seaModeLabel = CONTAINER_40.label;
    } else {
      const count = Math.ceil(totalVolume / CONTAINER_40.capacityCbm);
      seaMode = 'multi_40';
      seaContainerCount = count;
      seaCostNative = CONTAINER_40.cost * count;
      seaCostCurrency = CONTAINER_40.currency;
      seaModeLabel = `${CONTAINER_40.label} (x${count})`;
    }
  }

  return {
    destinationCode: dest.code,
    destinationLabel: dest.label,
    hub: dest.hub,
    nativeCurrency: dest.currency,
    totalWeight: weightKnown ? totalWeight : null,
    totalVolume: volumeKnown ? totalVolume : null,
    hasBattery,
    airAvailable,
    seaAvailable,
    airRatePerKg,
    seaRatePerCbm,
    airCostNative,
    seaCostNative,
    seaCostCurrency,
    seaMode,
    seaContainerCount,
    seaModeLabel,
    airCostCny: airCostNative != null ? nativeToCny(airCostNative, dest.currency) : null,
    seaCostCny:
      seaCostNative != null ? nativeToCny(seaCostNative, seaCostCurrency) : null,
  };
}
