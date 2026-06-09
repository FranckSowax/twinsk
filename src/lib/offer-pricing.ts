// Transport pricing for /offer/[uuid] checkout.
// Tarifs Twinsk fournis par l'admin :
//  - Aérien : 13 000 FCFA / kg (18 000 FCFA / kg si batterie au lithium)
//  - Maritime : 260 000 FCFA / m³

export const AIR_RATE_FCFA_PER_KG = 13000;
export const AIR_BATTERY_RATE_FCFA_PER_KG = 18000;
export const SEA_RATE_FCFA_PER_M3 = 260000;

// Taux de conversion CNY -> FCFA (mis à jour manuellement, ~91 FCFA / CNY).
// Sera remplacé par une source live si besoin.
export const CNY_TO_FCFA = 91;

export interface OrderLineForPricing {
  unit_price_cny: number;
  quantity: number;
  weight: number | null;
  volume: number | null;
  has_battery: boolean;
}

export interface PricingResult {
  itemsTotalCny: number;
  itemsTotalFcfa: number;
  totalWeight: number | null;
  totalVolume: number | null;
  hasBattery: boolean;
  airCost: number | null;
  seaCost: number | null;
  airAvailable: boolean;
  seaAvailable: boolean;
  airTotal: number | null;
  seaTotal: number | null;
}

export function computeOrderPricing(lines: OrderLineForPricing[]): PricingResult {
  const itemsTotalCny = lines.reduce(
    (s, l) => s + l.unit_price_cny * l.quantity,
    0,
  );
  const itemsTotalFcfa = itemsTotalCny * CNY_TO_FCFA;

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

  // Calcul aérien : applique le tarif batterie globalement si au moins une ligne
  // a une batterie (sécurité réglementaire) — la totalité du colis est dangereuse.
  const airRate = hasBattery ? AIR_BATTERY_RATE_FCFA_PER_KG : AIR_RATE_FCFA_PER_KG;
  const airCost = airAvailable ? totalWeight * airRate : null;
  const seaCost = seaAvailable ? totalVolume * SEA_RATE_FCFA_PER_M3 : null;

  return {
    itemsTotalCny,
    itemsTotalFcfa,
    totalWeight: weightKnown ? totalWeight : null,
    totalVolume: volumeKnown ? totalVolume : null,
    hasBattery,
    airCost,
    seaCost,
    airAvailable,
    seaAvailable,
    airTotal: airCost != null ? itemsTotalFcfa + airCost : null,
    seaTotal: seaCost != null ? itemsTotalFcfa + seaCost : null,
  };
}

export function formatFCFA(n: number | null | undefined): string {
  if (n == null) return 'Sur devis';
  // Arrondi au 500 superieur (politique de prix FCFA).
  const rounded = n > 0 ? Math.ceil(n / 500) * 500 : Math.round(n);
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(rounded) + ' FCFA';
}
