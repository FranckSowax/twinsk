// Transport pricing for /offer/[uuid] checkout.
// Tarifs Twinsk fournis par l'admin :
//  - Aérien : 13 000 FCFA / kg (18 000 FCFA / kg si batterie au lithium)
//  - Maritime : 260 000 FCFA / m³
import { roundXafUp } from '@/lib/utils/formatCurrency';

// Tarifs configurables via variables d'environnement (défauts Twinsk).
export const AIR_RATE_FCFA_PER_KG = Number(process.env.AIR_RATE_FCFA_PER_KG) || 13000;
// Tarif aérien spécial pour les produits AVEC batterie (lithium — dangereux).
export const AIR_BATTERY_RATE_FCFA_PER_KG = Number(process.env.AIR_BATTERY_RATE_FCFA_PER_KG) || 18000;
export const SEA_RATE_FCFA_PER_M3 = Number(process.env.SEA_RATE_FCFA_PER_M3) || 260000;

// Taux de conversion CNY -> FCFA (mis à jour manuellement, ~91 FCFA / CNY).
// IMPORTANT : garder synchronisé avec FX_RATES.XAF dans src/lib/utils/formatCurrency.ts.
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
  // Total produits = SOMME des sous-totaux de ligne arrondis (au 100 sup.).
  // C'est le montant affiché au client : garantit que lignes = total.
  itemsTotalFcfaRounded: number;
  totalWeight: number | null;
  totalVolume: number | null;
  hasBattery: boolean;
  airRate: number;
  seaRate: number;
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
  // Somme des sous-totaux de ligne arrondis individuellement — DOIT correspondre
  // à ce que le client additionne visuellement ligne par ligne.
  const itemsTotalFcfaRounded = lines.reduce(
    (s, l) => s + roundXafUp(l.unit_price_cny * l.quantity * CNY_TO_FCFA),
    0,
  );

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
    itemsTotalFcfaRounded,
    totalWeight: weightKnown ? totalWeight : null,
    totalVolume: volumeKnown ? totalVolume : null,
    hasBattery,
    airRate,
    seaRate: SEA_RATE_FCFA_PER_M3,
    airCost,
    seaCost,
    airAvailable,
    seaAvailable,
    // Total à payer = total produits arrondi (somme des lignes) + transport.
    airTotal: airCost != null ? itemsTotalFcfaRounded + airCost : null,
    seaTotal: seaCost != null ? itemsTotalFcfaRounded + seaCost : null,
  };
}

export function formatFCFA(n: number | null | undefined): string {
  if (n == null) return 'Sur devis';
  // Arrondi au 100 superieur (politique de prix FCFA).
  const rounded = n > 0 ? Math.ceil(n / 100) * 100 : Math.round(n);
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(rounded) + ' FCFA';
}
