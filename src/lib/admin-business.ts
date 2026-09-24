// Indicateurs commerciaux du tableau de bord : chiffre d'affaires, MARGE PRODUITS
// et transport, calculés sur les commandes payées.
//
// Marge produits : le prix affiché au client est le prix d'achat majoré de
// `margin_percent` (puis de la commission de l'affilié, le cas échéant).
//   prix affiché = prix d'achat × (1 + marge/100) × (1 + commission/100)
// donc   prix d'achat = prix affiché / ((1 + marge/100) × (1 + commission/100))
//   marge produits  = prix affiché − prix d'achat − commission affilié
// Le TRANSPORT n'entre pas dans la marge : il est refacturé au tarif du barème.
// Il est suivi à part (montant facturé), et déduit du total encaissé pour
// isoler ce qui vient réellement de la vente.

import { toFcfa, type SettlementCurrency } from '@/lib/offer-pricing';
import { LOCAL_CURRENCY } from '@/lib/local-currency';

export interface BusinessLine {
  product_id: string | null;
  quantity: number;
  unit_price_cny: number;
  /** Marge du produit au moment du calcul (%), 0 si inconnue. */
  margin_percent: number;
  price_type?: string | null;
}

export interface BusinessOrder {
  id: string;
  created_at: string;
  offer_id: string | null;
  offer_title?: string | null;
  currency: SettlementCurrency;
  transport_mode: string | null;
  /** Montants dans la devise de règlement de la commande. */
  items_total: number;
  transport_cost: number;
  discount: number;
  commission: number;
  lines: BusinessLine[];
}

export interface OrderMargin {
  /** Prix de vente des articles, remise déduite. */
  revenue: number;
  /** Prix d'achat fournisseur des articles vendus. */
  cost: number;
  /** Marge dégagée sur les articles (hors transport, hors commission affilié). */
  margin: number;
  /** Taux de marge sur le chiffre d'affaires articles (0 si pas de CA). */
  marginRate: number;
  commission: number;
  transport: number;
  /** Total encaissé = articles (remisés) + transport. */
  collected: number;
}

/** Taux de conversion CNY → devise de règlement de la commande. */
const rateFor = (c: SettlementCurrency) => (c === 'EUR' ? 1 / 7.7 : 91);

/**
 * Devise RÉELLE des montants stockés sur la commande. La devise d'un listing
 * peut être changée après coup : les montants déjà enregistrés restent alors
 * dans l'ancienne devise. On retient celle qui colle au total des lignes (CNY).
 */
export function effectiveCurrency(o: BusinessOrder): SettlementCurrency {
  const sellCny = o.lines.reduce((s, l) => s + l.unit_price_cny * l.quantity, 0);
  if (sellCny <= 0 || !o.items_total) return o.currency;
  const gap = (c: SettlementCurrency) => Math.abs(o.items_total - sellCny * rateFor(c)) / Math.max(1, o.items_total);
  return gap('EUR') < gap(LOCAL_CURRENCY) ? 'EUR' : LOCAL_CURRENCY;
}

/** Marge d'une commande, dans SA devise de règlement. */
export function orderMargin(o: BusinessOrder): OrderMargin {
  const fx = rateFor(effectiveCurrency(o));
  // Commission de l'affilié ramenée en pourcentage du prix d'achat majoré :
  // elle est déjà incluse dans unit_price_cny, il faut la retirer du coût.
  const sellCny = o.lines.reduce((s, l) => s + l.unit_price_cny * l.quantity, 0);
  const commissionCny = o.commission > 0 ? o.commission / fx : 0;
  const beforeCommission = sellCny - commissionCny;
  const commissionRatio = beforeCommission > 0 ? sellCny / beforeCommission : 1;

  const costCny = o.lines.reduce((s, l) => {
    // Une ligne « acompte » n'est pas une vente : ni CA, ni coût.
    if (l.price_type === 'acompte' || l.unit_price_cny <= 0) return s;
    const base = l.unit_price_cny / (1 + (l.margin_percent || 0) / 100) / commissionRatio;
    return s + base * l.quantity;
  }, 0);

  // Chiffre d'affaires reconstruit depuis les lignes (source de vérité, en CNY) :
  // insensible à un changement de devise du listing après la commande.
  const revenue = Math.max(0, (sellCny > 0 ? sellCny * fx : o.items_total) - o.discount);
  const cost = costCny * fx;
  const margin = revenue - cost - o.commission;
  return {
    revenue,
    cost,
    margin,
    marginRate: revenue > 0 ? margin / revenue : 0,
    commission: o.commission,
    transport: o.transport_cost,
    collected: revenue + o.transport_cost,
  };
}

export interface BusinessTotals extends OrderMargin {
  orders: number;
  /** Panier moyen (total encaissé / nombre de commandes). */
  averageOrder: number;
}

/** Cumul sur plusieurs commandes, TOUT converti en FCFA. */
export function totalsInFcfa(orders: BusinessOrder[]): BusinessTotals {
  const acc = orders.reduce(
    (a, o) => {
      const m = orderMargin(o);
      const f = (v: number) => toFcfa(v, effectiveCurrency(o));
      a.revenue += f(m.revenue);
      a.cost += f(m.cost);
      a.margin += f(m.margin);
      a.commission += f(m.commission);
      a.transport += f(m.transport);
      a.collected += f(m.collected);
      return a;
    },
    { revenue: 0, cost: 0, margin: 0, commission: 0, transport: 0, collected: 0 },
  );
  return {
    ...acc,
    marginRate: acc.revenue > 0 ? acc.margin / acc.revenue : 0,
    orders: orders.length,
    averageOrder: orders.length ? acc.collected / orders.length : 0,
  };
}

export interface Bucket {
  key: string;
  label: string;
  revenue: number;
  margin: number;
  transport: number;
  orders: number;
}

function push(map: Map<string, Bucket>, key: string, label: string, o: BusinessOrder) {
  const m = orderMargin(o);
  const cur = effectiveCurrency(o);
  const b = map.get(key) || { key, label, revenue: 0, margin: 0, transport: 0, orders: 0 };
  b.revenue += toFcfa(m.revenue, cur);
  b.margin += toFcfa(m.margin, cur);
  b.transport += toFcfa(m.transport, cur);
  b.orders += 1;
  map.set(key, b);
}

/** Série mensuelle des N derniers mois (vides compris), la plus ancienne d'abord. */
export function monthlySeries(orders: BusinessOrder[], months = 6, now = new Date()): Bucket[] {
  const map = new Map<string, Bucket>();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    keys.push(key);
    map.set(key, {
      key,
      label: d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
      revenue: 0,
      margin: 0,
      transport: 0,
      orders: 0,
    });
  }
  for (const o of orders) {
    const key = o.created_at.slice(0, 7);
    if (map.has(key)) push(map, key, map.get(key)!.label, o);
  }
  return keys.map((k) => map.get(k)!);
}

/** Répartition par listing, la plus rentable d'abord. */
export function byListing(orders: BusinessOrder[], top = 5): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const o of orders) push(map, o.offer_id || 'sans-listing', o.offer_title || 'Listing supprimé', o);
  return [...map.values()].sort((a, b) => b.margin - a.margin).slice(0, top);
}

const TRANSPORT_LABEL: Record<string, string> = {
  air: 'Aérien',
  sea: 'Maritime',
  mixed: 'Fractionné',
  quote: 'Sur devis',
};

/** Répartition par mode de transport. */
export function byTransport(orders: BusinessOrder[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const o of orders) {
    const k = o.transport_mode || 'none';
    push(map, k, TRANSPORT_LABEL[k] || 'Non choisi', o);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}
