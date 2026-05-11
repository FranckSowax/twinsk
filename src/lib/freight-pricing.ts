/**
 * Shared freight pricing logic — mirrors the LP calculator and is used
 * by the admin "Calculer le devis" auto-pricing button.
 */

export type FreightMode = 'sea' | 'air';
export type SeaService = 'lcl' | 'fcl20' | 'fcl40';

export interface DestinationDays {
  airDays: number;
  seaDays: number;
}

/** Default transit-day table mirroring the LP calculator destinations. */
const TRANSIT_DEFAULTS: Record<string, DestinationDays> = {
  Libreville: { airDays: 7, seaDays: 35 },
  Lomé: { airDays: 9, seaDays: 32 },
  Abidjan: { airDays: 8, seaDays: 30 },
  Douala: { airDays: 9, seaDays: 33 },
  Lagos: { airDays: 8, seaDays: 28 },
  Kinshasa: { airDays: 10, seaDays: 38 },
  Dakar: { airDays: 9, seaDays: 30 },
  Paris: { airDays: 5, seaDays: 28 },
  Bruxelles: { airDays: 5, seaDays: 30 },
  'New York': { airDays: 6, seaDays: 32 },
};

const FALLBACK_TRANSIT: DestinationDays = { airDays: 8, seaDays: 32 };

export interface FreightPricingInput {
  mode: FreightMode;
  sea_service?: SeaService | null;
  weight: number;
  volume: number;
  destination?: string;
}

export interface AutoQuote {
  base_price: number;
  transit_days: number;
  detail: string;
}

/** Compute the base freight price for a given request (USD). */
export function computeAutoQuote(input: FreightPricingInput): AutoQuote {
  const transit =
    (input.destination && TRANSIT_DEFAULTS[input.destination]) || FALLBACK_TRANSIT;
  const w = Math.max(0, input.weight || 0);
  const v = Math.max(0, input.volume || 0);

  if (input.mode === 'air') {
    const chargeable = Math.max(w, v * 167);
    return {
      base_price: Math.round(chargeable * 7.5),
      transit_days: transit.airDays,
      detail: `${chargeable.toFixed(1)} kg taxable · 7,5 $/kg`,
    };
  }

  if (input.sea_service === 'lcl') {
    const cbm = Math.max(v, 0.5);
    return {
      base_price: Math.round(cbm * 180),
      transit_days: transit.seaDays,
      detail: `${cbm.toFixed(2)} m³ (LCL) · 180 $/m³`,
    };
  }
  if (input.sea_service === 'fcl20') {
    return {
      base_price: 1450,
      transit_days: transit.seaDays,
      detail: "Conteneur 20' (≤ 25 m³) — forfait 1 450 $",
    };
  }
  return {
    base_price: 2500,
    transit_days: transit.seaDays + 2,
    detail: "Conteneur 40' (≤ 55 m³) — forfait 2 500 $",
  };
}

/** Default 12% Twinsk service fee, computed on the base price. */
export function defaultServiceFee(basePrice: number): number {
  return Math.round(basePrice * 0.12);
}

export interface QuoteLineItem {
  label: string;
  amount: number;
}

/** Sum a quote's components into the final total. */
export function computeTotal(
  basePrice: number,
  serviceFee: number,
  customsFee: number,
  otherFees: QuoteLineItem[],
): number {
  const sumOther = (otherFees || []).reduce(
    (acc, line) => acc + (Number(line.amount) || 0),
    0,
  );
  return Math.max(0, Math.round((basePrice + serviceFee + customsFee + sumOther) * 100) / 100);
}
