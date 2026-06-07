// Transport pricing for the quote PDF. Tarifs dependent de la destination
// (see src/lib/destinations.ts). On retourne le cout dans la devise native
// du pays + son equivalent CNY pour faciliter le calcul total cote PDF.

import {
  DEFAULT_DESTINATION,
  resolveDestination,
  type DestinationCode,
} from './destinations';
import { FX_RATES, type CurrencyCode } from './utils/formatCurrency';

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
  /** Tarif maritime (par m³, en devise native). */
  seaRatePerCbm: number;
  /** Cout aerien total dans la devise native. */
  airCostNative: number | null;
  /** Cout maritime total dans la devise native. */
  seaCostNative: number | null;
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
  const seaCostNative = seaAvailable ? totalVolume * seaRatePerCbm : null;

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
    airCostCny: airCostNative != null ? nativeToCny(airCostNative, dest.currency) : null,
    seaCostCny: seaCostNative != null ? nativeToCny(seaCostNative, dest.currency) : null,
  };
}
