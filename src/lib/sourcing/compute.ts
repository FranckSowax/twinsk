/**
 * Moteur de calcul du module Sourcing — portage littéral de compute() du cockpit
 * sourcing/cockpit_sourcing_assiette.html.
 *
 * Module PUR : aucune dépendance à React ni à la base. Appelé côté serveur pour la
 * vue partagée, et côté client pour le recalcul instantané à la saisie.
 *
 * Toute modification ici doit être validée par compute.test.ts, qui vérifie la
 * parité chiffrée avec le fichier HTML autonome.
 */

import { TWIST_PROVEN_THRESHOLD, TWIST_SCALE } from './defaults';
import type {
  SourcingParams,
  SourcingQuote,
  SourcingSupplier,
  SourcingWeights,
  TwistLock,
} from './types';

/* ═══ Helpers ═══ */

/**
 * Port du helper num() du cockpit : accepte la virgule décimale, rend null pour
 * tout ce qui n'est pas un nombre fini. null signifie « pas de réponse », jamais zéro.
 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Taux de la devise vers l'euro. Devise inconnue → 0, comme le cockpit (champ vide). */
export function fxRate(params: SourcingParams, currency: string | null | undefined): number {
  if (!currency) return 0;
  const r = params.fx?.[currency];
  return typeof r === 'number' && Number.isFinite(r) ? r : 0;
}

/** Note de faisabilité twist-lock sur 100. null (non répondu) → 0. */
export function twistScore(t: TwistLock | null | undefined): number {
  if (!t) return 0;
  return TWIST_SCALE.find((s) => s.value === t)?.score ?? 0;
}

/**
 * Conformité : 25 points par certificat REÇU (pas déclaré). 0 à 100.
 * L'absence de certificat vaut 0 — c'est une mesure, le certificat n'a pas été fourni.
 */
export function confScore(q: Pick<
  SourcingQuote,
  'cert_fda' | 'cert_lfgb' | 'cert_iso' | 'cert_migration'
> | null | undefined): number {
  if (!q) return 0;
  return (
    (q.cert_fda ? 25 : 0) +
    (q.cert_lfgb ? 25 : 0) +
    (q.cert_iso ? 25 : 0) +
    (q.cert_migration ? 25 : 0)
  );
}

/** Compatibilité MOQ. null si non renseigné : on ne juge pas une donnée absente. */
export function moqScore(moq: number | null, qty: number): number | null {
  if (moq == null) return null;
  if (moq <= qty) return 100;
  if (moq <= qty * 2) return 60;
  if (moq <= qty * 4) return 25;
  return 0;
}

/**
 * Normalisation inverse sur l'échantillon des répondants : le plus petit vaut 100.
 * Un seul répondant (max === min) → 100. Valeur absente → null.
 */
export function normalizeInverse(v: number | null, sample: number[]): number | null {
  if (v == null || !sample.length) return null;
  const mn = Math.min(...sample);
  const mx = Math.max(...sample);
  return mx === mn ? 100 : (100 * (mx - v)) / (mx - mn);
}

/* ═══ Coût débarqué ═══ */

export interface LandedCost {
  pricePerSetEur: number;
  toolingEur: number | null;
  cartons: number;
  volumeM3: number;
  weightKg: number | null;
  taxableUnits: number;
  goodsEur: number;
  freightEur: number;
  insuranceEur: number;
  cafEur: number;
  dutyEur: number;
  vatEur: number;
  /** Fret + assurance. */
  freightTotalEur: number;
  /** Droits + TVA. */
  taxTotalEur: number;
  totalEur: number;
  costPerSet: number;
  amortPerSet: number;
  logisticsPerSet: number;
}

/**
 * Coût débarqué d'une offre. Rend null si le trio prix / sets par carton / volume
 * de carton n'est pas complet : on n'estime JAMAIS une valeur manquante, la ligne
 * affiche « — » et le fournisseur reste hors de la grille de prix.
 */
export function computeLandedCost(
  quote: SourcingQuote | null | undefined,
  fx: number,
  params: SourcingParams,
): LandedCost | null {
  if (!quote) return null;

  const p5 = num(quote.price_5k);
  const setsPerCarton = num(quote.sets_per_carton);
  const cartonVolume = num(quote.carton_volume_m3);
  const cartonWeight = num(quote.carton_weight_kg);

  const pricePerSetEur = p5 != null ? p5 * fx : null;

  // Fidèle au cockpit : sets_per_carton doit être non nul (une division l'exige),
  // le volume peut valoir 0 mais pas être absent.
  if (pricePerSetEur == null || !setsPerCarton || cartonVolume == null) return null;

  // (moule assiette + moule couvercle) × fx, où 0 devient null : un outillage
  // à zéro n'existe pas, c'est une absence de réponse.
  const toolingEur = ((num(quote.mould_plate_cost) ?? 0) + (num(quote.mould_lid_cost) ?? 0)) * fx || null;

  const qty = params.qty;
  const cartons = Math.ceil(qty / setsPerCarton);
  const volumeM3 = cartons * cartonVolume;
  const weightKg = cartonWeight != null ? cartons * cartonWeight : null;

  // Le fret LCL est facturé au plus élevé du volume en m³ ou du poids en tonnes.
  const taxableUnits = Math.max(volumeM3, (weightKg ?? 0) / 1000);

  const goodsEur = pricePerSetEur * qty;
  const freightEur = taxableUnits * params.freight_rate_eur_m3;
  const insuranceEur = (goodsEur + freightEur) * (params.insurance_pct / 100);
  const cafEur = goodsEur + freightEur + insuranceEur;
  const dutyEur = cafEur * (params.duty_pct / 100);
  const vatEur = (cafEur + dutyEur) * (params.vat_pct / 100);

  const freightTotalEur = freightEur + insuranceEur;
  const taxTotalEur = dutyEur + vatEur;
  const totalEur = cafEur + dutyEur + vatEur + (toolingEur ?? 0);

  return {
    pricePerSetEur,
    toolingEur,
    cartons,
    volumeM3,
    weightKg,
    taxableUnits,
    goodsEur,
    freightEur,
    insuranceEur,
    cafEur,
    dutyEur,
    vatEur,
    freightTotalEur,
    taxTotalEur,
    totalEur,
    costPerSet: totalEur / qty,
    amortPerSet: (toolingEur ?? 0) / qty,
    logisticsPerSet: (freightTotalEur + taxTotalEur) / qty,
  };
}

/* ═══ Lignes calculées ═══ */

export interface SupplierWithQuote {
  supplier: SourcingSupplier;
  quote: SourcingQuote | null;
}

export interface ComputedRow {
  supplier: SourcingSupplier;
  quote: SourcingQuote | null;
  currency: string | null;
  fx: number;
  included: boolean;
  /** Prix par palier, en devise native. */
  price5k: number | null;
  price10k: number | null;
  price20k: number | null;
  /** Dégressivité 5k → 20k en %, null si un des deux paliers manque. */
  degressivityPct: number | null;
  landed: LandedCost | null;
  moq: number | null;
  /** Délai total : outillage T1 + production + échantillon. null si aucun des trois. */
  leadDays: number | null;
  replied: boolean;
  /* Notes de critère, chacune sur 100 */
  twist: number;
  conf: number;
  solid: number | null;
  nCost: number | null;
  nMoq: number | null;
  nLead: number | null;
  /** Somme des poids réellement couverts par des notes non nulles. */
  covered: number;
  score: number | null;
  scorable: boolean;
  rank: number | null;
  /** Motif d'absence de note, à afficher à la place du rang. */
  pending: string | null;
}

export interface SourcingKpis {
  /** Fournisseurs inclus au panel. */
  activeCount: number;
  consulted: number;
  replied: number;
  /** En %, non arrondi. 0 si aucun fournisseur consulté. */
  responseRate: number;
  provenTwistLock: number;
  bestCostPerSet: number | null;
  /** Écart min → max en %, null s'il y a moins de deux offres chiffrées. */
  spreadPct: number | null;
  quotedCount: number;
}

export interface ComputeResult {
  params: SourcingParams;
  weights: SourcingWeights;
  weightsSum: number;
  /** Toutes les lignes, dans l'ordre d'entrée. */
  rows: ComputedRow[];
  /** Lignes incluses au panel. */
  active: ComputedRow[];
  /** Lignes chiffrées, triées par coût par set croissant. */
  withCost: ComputedRow[];
  /** Lignes notées, triées par score décroissant. */
  ranked: ComputedRow[];
  kpis: SourcingKpis;
}

export interface ComputeInput {
  params: SourcingParams;
  weights: SourcingWeights;
  entries: SupplierWithQuote[];
}

export function computeProject({ params, weights, entries }: ComputeInput): ComputeResult {
  const rows: ComputedRow[] = entries.map(({ supplier, quote }) => {
    const currency = quote?.currency || supplier.default_currency || null;
    const fx = fxRate(params, currency);
    const landed = computeLandedCost(quote, fx, params);

    const price5k = num(quote?.price_5k);
    const price20k = num(quote?.price_20k);

    // Délai total. Le || null final reproduit le cockpit : une somme nulle signifie
    // qu'aucun des trois délais n'a été communiqué, pas qu'ils valent zéro.
    const leadDays =
      (num(quote?.tooling_days) ?? 0) +
        (num(quote?.production_days) ?? 0) +
        (num(quote?.sample_days) ?? 0) || null;

    // Le cockpit préremplit le champ MOQ avec celui documenté en due diligence ;
    // une saisie dans la réponse au devis prend le dessus.
    const moq = num(quote?.moq) ?? supplier.known_moq ?? null;

    return {
      supplier,
      quote: quote ?? null,
      currency,
      fx,
      included: supplier.included,
      price5k,
      price10k: num(quote?.price_10k),
      price20k,
      degressivityPct:
        price5k != null && price20k != null && price5k !== 0
          ? (1 - price20k / price5k) * 100
          : null,
      landed,
      moq,
      leadDays,
      replied: !!quote?.replied_at,
      twist: twistScore(quote?.twist_lock),
      conf: confScore(quote),
      solid: supplier.solidity ?? null,
      nCost: null,
      nMoq: null,
      nLead: null,
      covered: 0,
      score: null,
      scorable: false,
      rank: null,
      pending: null,
    };
  });

  // Normalisation du coût et du délai sur les seuls fournisseurs inclus au panel :
  // un fournisseur écarté ne doit pas déplacer l'échelle des autres.
  const active = rows.filter((r) => r.included);
  const costs = active
    .map((r) => r.landed?.costPerSet)
    .filter((v): v is number => v != null);
  const leads = active.map((r) => r.leadDays).filter((v): v is number => v != null);

  for (const r of rows) {
    r.nCost = normalizeInverse(r.landed?.costPerSet ?? null, costs);
    r.nLead = normalizeInverse(r.leadDays, leads);
    r.nMoq = moqScore(r.moq, params.qty);

    // Un fournisseur n'est noté que s'il a réellement répondu quelque chose.
    // Sans donnée, un score de 0 sur la faisabilité serait un jugement, pas une
    // mesure — et le classement serait faux de façon crédible.
    const hasData = r.replied || r.twist > 0 || r.price5k != null || r.conf > 0;
    const refused = r.quote?.status === 'a_refuse';
    r.scorable = r.included && hasData && !refused;

    if (!r.scorable) {
      r.score = null;
      r.covered = 0;
      r.pending = refused ? 'a refusé' : 'en attente de réponse';
      continue;
    }

    const parts: Array<[number | null, number]> = [
      [r.twist, weights.twist],
      [r.conf, weights.conf],
      [r.solid, weights.solid],
      [r.nCost, weights.cost],
      [r.nMoq, weights.moq],
      [r.nLead, weights.lead],
    ];
    let sw = 0;
    let sv = 0;
    for (const [v, w] of parts) {
      if (v != null && w > 0) {
        sw += w;
        sv += v * w;
      }
    }
    // Renormalisation volontaire : un fournisseur qui n'a pas encore livré son
    // colisage n'est pas puni sur un critère qu'on ne lui a pas encore demandé.
    r.score = sw > 0 ? sv / sw : null;
    r.covered = sw;
    r.pending = null;
  }

  const withCost = active
    .filter((r) => r.landed != null)
    .sort((a, b) => a.landed!.costPerSet - b.landed!.costPerSet);

  const ranked = active
    .filter((r) => r.score != null)
    .sort((a, b) => b.score! - a.score!);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });

  const consulted = active.filter(
    (r) => r.quote?.status && r.quote.status !== 'a_contacter',
  ).length;
  const replied = active.filter((r) => r.replied).length;

  return {
    params,
    weights,
    weightsSum: Object.values(weights).reduce((a, b) => a + b, 0),
    rows,
    active,
    withCost,
    ranked,
    kpis: {
      activeCount: active.length,
      consulted,
      replied,
      responseRate: consulted ? (100 * replied) / consulted : 0,
      provenTwistLock: active.filter((r) => r.twist >= TWIST_PROVEN_THRESHOLD).length,
      bestCostPerSet: withCost.length ? withCost[0].landed!.costPerSet : null,
      spreadPct:
        withCost.length > 1
          ? (withCost[withCost.length - 1].landed!.costPerSet / withCost[0].landed!.costPerSet - 1) * 100
          : null,
      quotedCount: withCost.length,
    },
  };
}
