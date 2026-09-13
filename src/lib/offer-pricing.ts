// Transport pricing for /offer/[uuid] checkout.
// Tarifs Twinsk fournis par l'admin :
//  - Aérien : 13 000 FCFA / kg (18 000 FCFA / kg si batterie au lithium)
//  - Maritime : 240 000 FCFA / m³ (260 000 jusqu’au 10 sept. 2026)
// Devise de règlement : FCFA par défaut ; quand le listing est affiché en euros
// (offer_currency = EUR), la commande se règle en euros avec les tarifs
// transport des devis Europe (10 €/kg, 390 €/m³, pas de grille dégressive).
import { FX_RATES, roundXafUp } from '@/lib/utils/formatCurrency';
import { DESTINATIONS } from '@/lib/destinations';

/** Devise dans laquelle une commande /offer est chiffrée et réglée. */
export type SettlementCurrency = 'XAF' | 'EUR';

/** Devise de règlement d'un listing : EUR si l'admin affiche l'offre en euros, sinon FCFA. */
export function settlementCurrencyOf(offerCurrency: unknown): SettlementCurrency {
  return offerCurrency === 'EUR' ? 'EUR' : 'XAF';
}

// Tarifs euros = ceux des devis Europe (source unique : destinations.france).
export const EUR_AIR_RATE_PER_KG = DESTINATIONS.france.air_rate_per_kg;
export const EUR_AIR_BATTERY_RATE_PER_KG = DESTINATIONS.france.air_battery_rate_per_kg;
export const EUR_SEA_RATE_PER_M3 = DESTINATIONS.france.sea_rate_per_cbm;
export const CNY_TO_EUR = FX_RATES.EUR;

/** Arrondi commercial dans la devise de règlement : FCFA au 100 supérieur, euros au centime. */
export function roundSettlement(amount: number, currency: SettlementCurrency): number {
  if (currency === 'EUR') return Math.round(amount * 100) / 100;
  return roundXafUp(amount);
}

/** Montant FCFA → devise de règlement (identité en FCFA). */
export function fromFcfa(amountFcfa: number, currency: SettlementCurrency): number {
  if (currency === 'EUR') return (amountFcfa / FX_RATES.XAF) * FX_RATES.EUR;
  return amountFcfa;
}

/** Devise de règlement → FCFA (identité en FCFA). */
export function toFcfa(amount: number, currency: SettlementCurrency): number {
  if (currency === 'EUR') return (amount / FX_RATES.EUR) * FX_RATES.XAF;
  return amount;
}

/** Formate un montant de la devise de règlement (null = sur devis). */
export function formatSettlement(n: number | null | undefined, currency: SettlementCurrency): string {
  if (n == null) return 'Sur devis';
  if (currency === 'EUR') {
    return `${(Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }
  return formatFCFA(n);
}

/** Libellé court d'un tarif unitaire (« 13 000 FCFA / kg », « 10,00 € / kg »). */
export function formatSettlementRate(rate: number, unit: 'kg' | 'm³', currency: SettlementCurrency): string {
  if (currency === 'EUR') {
    return `${rate.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} € / ${unit}`;
  }
  return `${Math.round(rate).toLocaleString('fr-FR')} FCFA / ${unit}`;
}

// Tarifs configurables via variables d'environnement (défauts Twinsk).
export const AIR_RATE_FCFA_PER_KG = Number(process.env.AIR_RATE_FCFA_PER_KG) || 13000;
// Tarif aérien spécial pour les produits AVEC batterie (lithium — dangereux).
export const AIR_BATTERY_RATE_FCFA_PER_KG = Number(process.env.AIR_BATTERY_RATE_FCFA_PER_KG) || 18000;
export const SEA_RATE_FCFA_PER_M3 = Number(process.env.SEA_RATE_FCFA_PER_M3) || 240000;

// Grille dégressive maritime (décision du 10 sept. 2026) : plein tarif jusqu'à
// 2,5 m³, puis le tarif au m³ baisse linéairement jusqu'à 28 m³ = 5 000 000 FCFA
// (≈ 178 571 FCFA / m³). Au-delà de 28 m³, le tarif plancher s'applique.
export const SEA_DEGRESSIVE_FROM_M3 = 2.5;
export const SEA_DEGRESSIVE_TO_M3 = 28;
export const SEA_DEGRESSIVE_TO_TOTAL_FCFA = 5_000_000;
export const SEA_RATE_FLOOR_FCFA_PER_M3 = SEA_DEGRESSIVE_TO_TOTAL_FCFA / SEA_DEGRESSIVE_TO_M3;

/**
 * Tarif maritime au m³ pour un volume de commande donné (FCFA / m³, non arrondi).
 * ≤ 2,5 m³ → tarif de base ; 2,5 → 28 m³ → interpolation linéaire vers le plancher ;
 * ≥ 28 m³ → plancher. Le total (volume × tarif) reste croissant sur toute la plage.
 */
export function seaRateForVolume(volumeM3: number, baseRate: number = SEA_RATE_FCFA_PER_M3): number {
  if (!Number.isFinite(volumeM3) || volumeM3 <= SEA_DEGRESSIVE_FROM_M3) return baseRate;
  const floor = Math.min(baseRate, SEA_RATE_FLOOR_FCFA_PER_M3);
  if (volumeM3 >= SEA_DEGRESSIVE_TO_M3) return floor;
  const t = (volumeM3 - SEA_DEGRESSIVE_FROM_M3) / (SEA_DEGRESSIVE_TO_M3 - SEA_DEGRESSIVE_FROM_M3);
  return baseRate - (baseRate - floor) * t;
}

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

/** Ajustements d'un code promo : tarif transport imposé et/ou remise articles. */
export interface PricingOptions {
  airRate?: number | null; // FCFA / kg imposé (code air_rate)
  seaRate?: number | null; // FCFA / m³ imposé (code sea_rate)
  discountFcfa?: number | null; // remise sur le total articles (hors transport), toujours en FCFA
  /** Devise de règlement (défaut FCFA). En euros, tous les montants « Fcfa » du résultat sont en euros. */
  currency?: SettlementCurrency;
}

/**
 * Montants dans la DEVISE DE RÈGLEMENT (`currency`) : les champs gardent leur
 * nom historique « Fcfa » mais sont en euros pour une commande en euros.
 */
export interface PricingResult {
  currency: SettlementCurrency;
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
  /** Remise articles appliquée (code promo), déjà déduite des totaux. */
  discountFcfa: number;
  /** Total articles après remise — c'est lui qui entre dans le total à payer. */
  itemsNetFcfa: number;
}

export function computeOrderPricing(lines: OrderLineForPricing[], opts: PricingOptions = {}): PricingResult {
  const currency: SettlementCurrency = opts.currency === 'EUR' ? 'EUR' : 'XAF';
  const rate = currency === 'EUR' ? CNY_TO_EUR : CNY_TO_FCFA;
  const itemsTotalCny = lines.reduce(
    (s, l) => s + l.unit_price_cny * l.quantity,
    0,
  );
  const itemsTotalFcfa = itemsTotalCny * rate;
  // Somme des sous-totaux de ligne arrondis individuellement — DOIT correspondre
  // à ce que le client additionne visuellement ligne par ligne.
  const itemsTotalFcfaRounded = lines.reduce(
    (s, l) => s + roundSettlement(l.unit_price_cny * l.quantity * rate, currency),
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
  const defaultAirRate =
    currency === 'EUR'
      ? hasBattery
        ? EUR_AIR_BATTERY_RATE_PER_KG
        : EUR_AIR_RATE_PER_KG
      : hasBattery
        ? AIR_BATTERY_RATE_FCFA_PER_KG
        : AIR_RATE_FCFA_PER_KG;
  // Tarif imposé par un code promo transport (saisi en FCFA, converti dans la
  // devise de règlement) — jamais plus cher que le tarif normal.
  const promoAir = opts.airRate != null && opts.airRate > 0 ? fromFcfa(opts.airRate, currency) : null;
  const airRate = promoAir != null ? Math.min(promoAir, defaultAirRate) : defaultAirRate;
  // Maritime : en FCFA, tarif dégressif selon le volume total ; en euros, tarif
  // fixe des devis Europe. Un tarif négocié (code promo) s'applique s'il est
  // encore plus bas, jamais au-dessus.
  const degressiveSeaRate =
    currency === 'EUR' ? EUR_SEA_RATE_PER_M3 : seaAvailable ? seaRateForVolume(totalVolume) : SEA_RATE_FCFA_PER_M3;
  const promoSea = opts.seaRate != null && opts.seaRate > 0 ? fromFcfa(opts.seaRate, currency) : null;
  const seaRate = promoSea != null ? Math.min(promoSea, degressiveSeaRate) : degressiveSeaRate;
  // En euros, coûts et totaux au centime ; en FCFA, inchangés (bruts, comme avant).
  const cents = (n: number) => (currency === 'EUR' ? Math.round(n * 100) / 100 : n);
  const airCost = airAvailable ? cents(totalWeight * airRate) : null;
  const seaCost = seaAvailable ? cents(totalVolume * seaRate) : null;

  // Remise articles (hors transport, saisie en FCFA), bornée au total articles.
  const rawDiscount = fromFcfa(Math.max(0, opts.discountFcfa ?? 0), currency);
  const discountFcfa = Math.min(
    currency === 'EUR' ? Math.round(rawDiscount * 100) / 100 : Math.round(rawDiscount),
    itemsTotalFcfaRounded,
  );
  const itemsNetFcfa = cents(itemsTotalFcfaRounded - discountFcfa);

  return {
    currency,
    itemsTotalCny,
    itemsTotalFcfa,
    itemsTotalFcfaRounded,
    totalWeight: weightKnown ? totalWeight : null,
    totalVolume: volumeKnown ? totalVolume : null,
    hasBattery,
    airRate,
    seaRate,
    airCost,
    seaCost,
    airAvailable,
    seaAvailable,
    discountFcfa,
    itemsNetFcfa,
    // Total à payer = total produits arrondi (somme des lignes) − remise + transport.
    airTotal: airCost != null ? cents(itemsNetFcfa + airCost) : null,
    seaTotal: seaCost != null ? cents(itemsNetFcfa + seaCost) : null,
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
