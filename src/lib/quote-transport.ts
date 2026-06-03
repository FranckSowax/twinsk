// Transport pricing for the quote PDF. Same rates as /offer checkout.
// - Aérien : 13 000 FCFA / kg (18 000 FCFA / kg si au moins un produit
//   contient une batterie au lithium)
// - Maritime groupage : 260 000 FCFA / m³

import {
  AIR_RATE_FCFA_PER_KG,
  AIR_BATTERY_RATE_FCFA_PER_KG,
  SEA_RATE_FCFA_PER_M3,
} from './offer-pricing';

export interface QuoteLine {
  quantity: number;
  weight: number | null; // kg unitaire
  volume: number | null; // m³ unitaire
  has_battery?: boolean | null;
}

export interface QuoteTransportSummary {
  totalWeight: number | null;
  totalVolume: number | null;
  hasBattery: boolean;
  airAvailable: boolean;
  seaAvailable: boolean;
  airRatePerKg: number;
  seaRatePerCbm: number;
  airCostFcfa: number | null;
  seaCostFcfa: number | null;
}

export function computeQuoteTransport(lines: QuoteLine[]): QuoteTransportSummary {
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
  const airRatePerKg = hasBattery ? AIR_BATTERY_RATE_FCFA_PER_KG : AIR_RATE_FCFA_PER_KG;

  return {
    totalWeight: weightKnown ? totalWeight : null,
    totalVolume: volumeKnown ? totalVolume : null,
    hasBattery,
    airAvailable,
    seaAvailable,
    airRatePerKg,
    seaRatePerCbm: SEA_RATE_FCFA_PER_M3,
    airCostFcfa: airAvailable ? totalWeight * airRatePerKg : null,
    seaCostFcfa: seaAvailable ? totalVolume * SEA_RATE_FCFA_PER_M3 : null,
  };
}
