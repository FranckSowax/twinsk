// Transport pricing for the quote PDF. Tarifs dependent de la destination
// (see src/lib/destinations.ts). On retourne le cout dans la devise native
// du pays + son equivalent CNY pour faciliter le calcul total cote PDF.

import { seaRateForVolume } from '@/lib/offer-pricing';
import {
  CONTAINER_20,
  CONTAINER_40,
  DEFAULT_DESTINATION,
  GROUPAGE_MAX_CBM,
  destinationLabel as destinationLabelFor,
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
  /** Tarif aerien STANDARD (par kg, en devise native) — produits sans batterie. */
  airRatePerKg: number;
  /** Tarif aerien batterie (par kg, en devise native) — produits avec batterie. */
  airBatteryRatePerKg: number;
  /** Kilos sans / avec batterie (null si un poids manque). */
  airWeightStd: number | null;
  airWeightBattery: number | null;
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
  /** Cout maritime total exprime en CNY (fret + camion éventuel). */
  seaCostCny: number | null;
  /** Poids volumétrique total (volume × facteur de la destination), null si non applicable. */
  volumetricWeight: number | null;
  /** Poids taxable aérien / ferroviaire = max(poids réel, poids volumétrique). */
  chargeableWeight: number | null;
  /** Ferroviaire proposé pour cette destination (tarif connu). */
  trainOffered: boolean;
  trainAvailable: boolean;
  trainRatePerKg: number | null;
  trainCostNative: number | null;
  trainCostCny: number | null;
  /** Maritime : fret seul (devise seaCostCurrency), hors camion. */
  seaFreightNative: number | null;
  /** Camion depuis le hub (ex. Paris → Bordeaux), dans la devise du pays. */
  seaTruck: { from: string; city: string; pallets: number; perPallet: number; costNative: number } | null;
  /** Délais porte à porte indicatifs par mode, en jours. */
  transitDays: Partial<Record<'air' | 'sea' | 'train', [number, number]>>;
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
  let weightBattery = 0;
  let totalVolume = 0;
  let weightKnown = true;
  let volumeKnown = true;
  let hasBattery = false;

  for (const l of lines) {
    if (l.has_battery) hasBattery = true;
    if (l.weight != null) {
      totalWeight += l.weight * l.quantity;
      if (l.has_battery) weightBattery += l.weight * l.quantity;
    } else weightKnown = false;
    if (l.volume != null) totalVolume += l.volume * l.quantity;
    else volumeKnown = false;
  }

  const airAvailable = weightKnown && totalWeight > 0;
  const seaAvailable = volumeKnown && totalVolume > 0;
  // Poids taxable (aérien et train) : max(poids réel, volume × facteur) quand la
  // destination fixe un facteur et que le volume est connu ; sinon poids réel.
  const volumetricWeight = dest.volumetric_kg_per_cbm && volumeKnown ? totalVolume * dest.volumetric_kg_per_cbm : null;
  const chargeableWeight = weightKnown ? Math.max(totalWeight, volumetricWeight ?? 0) : null;
  // Aérien scindé : kilos sans batterie au tarif standard, kilos avec batterie
  // au tarif batterie (plus de majoration sur tout le lot).
  const airRatePerKg = dest.air_rate_per_kg;
  const airBatteryRatePerKg = dest.air_battery_rate_per_kg;
  const weightStd = totalWeight - weightBattery;
  // Gabon (FCFA) : grille dégressive de 3 à 20 m³, 240 000 → 205 000 (même règle que le
  // checkout) ; autres destinations : tarif plat de la destination.
  const seaRatePerCbm = dest.currency === 'XAF' ? seaRateForVolume(totalVolume, dest.sea_rate_per_cbm) : dest.sea_rate_per_cbm;

  // Le poids taxable se répartit entre standard et batterie au prorata du poids réel
  // (sans facteur volumétrique : poids réel, calcul inchangé).
  const scale = airAvailable && chargeableWeight != null ? chargeableWeight / totalWeight : 1;
  const airCostNative = airAvailable ? (weightStd * airRatePerKg + weightBattery * airBatteryRatePerKg) * scale : null;
  const trainOffered = dest.train_rate_per_kg != null;
  const trainAvailable = trainOffered && airAvailable;
  const trainCostNative = trainAvailable && chargeableWeight != null ? chargeableWeight * dest.train_rate_per_kg! : null;

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

  // Camion depuis le hub vers certaines villes (France : Paris → Bordeaux), à la palette.
  let seaTruck: QuoteTransportSummary['seaTruck'] = null;
  const typed = (destinationCode || '').toString();
  if (seaAvailable && dest.sea_truck) {
    const leg = dest.sea_truck.legs.find((l) => l.match.test(typed));
    if (leg) {
      const pallets = Math.max(1, Math.ceil(totalVolume / dest.sea_truck.pallet_capacity_cbm - 1e-9));
      seaTruck = { from: dest.sea_truck.from, city: leg.city, pallets, perPallet: leg.per_pallet, costNative: pallets * leg.per_pallet };
    }
  }
  const seaFreightCny = seaCostNative != null ? nativeToCny(seaCostNative, seaCostCurrency) : null;
  const seaTruckCny = seaTruck ? nativeToCny(seaTruck.costNative, dest.currency) : 0;

  return {
    destinationCode: dest.code,
    destinationLabel: destinationLabelFor(destinationCode), // texte saisi (ville / pays), tarifs du pays reconnu
    hub: dest.hub,
    nativeCurrency: dest.currency,
    totalWeight: weightKnown ? totalWeight : null,
    totalVolume: volumeKnown ? totalVolume : null,
    hasBattery,
    airAvailable,
    seaAvailable,
    airRatePerKg,
    airBatteryRatePerKg,
    airWeightStd: weightKnown ? weightStd : null,
    airWeightBattery: weightKnown ? weightBattery : null,
    seaRatePerCbm,
    airCostNative,
    // Groupage : même devise que le camion, on additionne ; conteneur : fret seul
    // (le camion est détaillé à part et compté dans seaCostCny).
    seaCostNative: seaCostNative != null && seaTruck && seaCostCurrency === dest.currency ? seaCostNative + seaTruck.costNative : seaCostNative,
    seaCostCurrency,
    seaMode,
    seaContainerCount,
    seaModeLabel,
    airCostCny: airCostNative != null ? nativeToCny(airCostNative, dest.currency) : null,
    seaCostCny: seaFreightCny != null ? seaFreightCny + seaTruckCny : null,
    volumetricWeight,
    chargeableWeight,
    trainOffered,
    trainAvailable,
    trainRatePerKg: dest.train_rate_per_kg ?? null,
    trainCostNative,
    trainCostCny: trainCostNative != null ? nativeToCny(trainCostNative, dest.currency) : null,
    seaFreightNative: seaCostNative,
    seaTruck,
    transitDays: dest.transit_days ?? {},
  };
}

/** Mode de transport retenu pour un document : un seul mode, ou « au choix » (le moins cher). */
export type QuoteTransportMode = 'air' | 'sea' | 'train' | 'both';
export const QUOTE_TRANSPORT_MODES: QuoteTransportMode[] = ['air', 'sea', 'train', 'both'];
export function normalizeQuoteTransportMode(v: unknown): QuoteTransportMode {
  return v === 'air' || v === 'sea' || v === 'train' ? v : 'both';
}
export const QUOTE_TRANSPORT_LABEL: Record<QuoteTransportMode, string> = {
  air: 'Aérien',
  sea: 'Maritime',
  train: 'Ferroviaire',
  both: 'Au choix (le moins cher retenu)',
};

/** Modes affichés sur le document : le mode choisi, ou tous les modes proposés pour « au choix ». */
export function quoteModesShown(mode: QuoteTransportMode, trainOffered: boolean): { air: boolean; sea: boolean; train: boolean } {
  if (mode === 'both') return { air: true, sea: true, train: trainOffered };
  return { air: mode === 'air', sea: mode === 'sea', train: mode === 'train' };
}

/** Coût transport (CNY) retenu pour le total selon le mode choisi (« au choix » : le moins cher). */
export function pickQuoteTransportCny(
  t: { airCostCny: number | null; seaCostCny: number | null; trainCostCny?: number | null },
  mode: QuoteTransportMode,
): number | null {
  if (mode === 'air') return t.airCostCny;
  if (mode === 'sea') return t.seaCostCny;
  if (mode === 'train') return t.trainCostCny ?? null;
  const costs = [t.airCostCny, t.seaCostCny, t.trainCostCny ?? null].filter((c): c is number => c != null);
  return costs.length ? Math.min(...costs) : null;
}

/** « 23 à 32 jours » */
export function transitLabelDays(d: [number, number] | undefined): string | null {
  return d ? `${d[0]} à ${d[1]} jours` : null;
}
