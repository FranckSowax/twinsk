// Prix reçus des usines (1er oct. 2026) : logique pure, testée.
// Une offre suit la façon dont l'usine envoie son prix : prix simple,
// variantes (hauteur, couleur…), paliers de quantité, options, frais fixes.
// Chaque prix est saisi dans la devise de l'usine, converti dans la devise du
// projet (taux du projet), puis majoré de la marge (% par défaut du projet,
// modifiable par offre, ou somme fixe par unité) : c'est ce prix retravaillé
// que voit le client.

import { toBase, type Rates } from './fx';

export type OfferItemKind = 'base' | 'option' | 'fee';
export interface OfferTier {
  min_qty: number;
  price: number;
}
export interface OfferItem {
  id: string;
  kind: OfferItemKind;
  label: string;
  /** Variante : { Hauteur: '30 mm', Couleur: 'vert' }. */
  variant: Record<string, string>;
  unit: string;
  /** Prix unitaire (devise de l'offre) ; null si seulement des paliers. */
  price: number | null;
  /** Paliers de quantité : prix applicable à partir de min_qty. */
  tiers: OfferTier[];
  /** Frais : par unité ou une fois par commande. */
  per: 'unit' | 'order';
  /** Ligne du devis correspondante (quantité du projet). */
  quote_line_id: string | null;
}
export interface OfferMargin {
  mode: 'pct' | 'amount';
  /** % (mode pct, null = défaut du projet) ou somme par unité dans la devise du projet (mode amount). */
  value: number | null;
}

// Nombre saisi ou extrait (« 4,90 », « 4.9 », 4.9) ; absent ou vide = null, jamais 0.
const num = (v: unknown): number | null => {
  if (v == null || (typeof v === 'string' && !v.trim())) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Nettoie une ligne d'offre saisie ou extraite ; null si inexploitable. */
export function cleanItem(raw: unknown, i = 0): OfferItem | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const label = str(o.label, 160);
  const tiers = (Array.isArray(o.tiers) ? o.tiers : [])
    .map((t) => {
      const x = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
      const q = num(x.min_qty);
      const p = num(x.price);
      return q != null && q >= 0 && p != null && p >= 0 ? { min_qty: q, price: r4(p) } : null;
    })
    .filter((t): t is OfferTier => !!t)
    .sort((a, b) => a.min_qty - b.min_qty)
    .filter((t, k, a) => k === 0 || t.min_qty !== a[k - 1].min_qty)
    .slice(0, 12);
  const price = num(o.price);
  if (!label || (price == null && !tiers.length)) return null;
  const variant: Record<string, string> = {};
  for (const [k, v] of Object.entries((o.variant && typeof o.variant === 'object' ? o.variant : {}) as Record<string, unknown>)) {
    const kk = str(k, 40);
    const vv = str(String(v ?? ''), 80);
    if (kk && vv) variant[kk] = vv;
  }
  const kind: OfferItemKind = o.kind === 'option' || o.kind === 'fee' ? o.kind : 'base';
  return {
    id: str(o.id, 40) || `it${i + 1}`,
    kind,
    label,
    variant,
    unit: str(o.unit, 20) || (kind === 'fee' ? 'forfait' : 'pièce'),
    price: price != null && price >= 0 ? r4(price) : null,
    tiers,
    per: o.per === 'order' || (kind === 'fee' && o.per !== 'unit') ? 'order' : 'unit',
    quote_line_id: str(o.quote_line_id, 40) || null,
  };
}

/** « Hauteur=30 mm; Couleur=vert » ⇄ { Hauteur: '30 mm', Couleur: 'vert' } (saisie rapide). */
export function parseVariant(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(/[;\n]/)) {
    const [k, ...v] = part.split(/[=:]/);
    if (k?.trim() && v.join('=').trim()) out[k.trim().slice(0, 40)] = v.join('=').trim().slice(0, 80);
  }
  return out;
}
export const formatVariant = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k}=${x}`).join('; ');
/** « 2000:4.9; 5000:4.6 » ⇄ paliers. */
export function parseTiers(text: string): OfferTier[] {
  return text
    .split(/[;\n]/)
    .map((p) => p.split(/[:→>]/).map((x) => num(x)))
    .filter(([q, p]) => q != null && p != null)
    .map(([q, p]) => ({ min_qty: q as number, price: p as number }))
    .sort((a, b) => a.min_qty - b.min_qty);
}
export const formatTiers = (t: OfferTier[]) => t.map((x) => `${x.min_qty}:${x.price}`).join('; ');

/**
 * Prix unitaire d'usine (devise de l'offre) à une quantité : palier le plus
 * haut atteint ; sous le premier palier, prix de base s'il existe, sinon premier
 * palier (signalé « sous le minimum »).
 */
export function unitCostAt(item: OfferItem, qty: number | null): { price: number | null; belowMin: boolean; tier: OfferTier | null } {
  if (!item.tiers.length || qty == null) return { price: item.price ?? item.tiers[0]?.price ?? null, belowMin: false, tier: null };
  const reached = [...item.tiers].reverse().find((t) => qty >= t.min_qty) || null;
  if (reached) return { price: reached.price, belowMin: false, tier: reached };
  return { price: item.price ?? item.tiers[0].price, belowMin: item.price == null, tier: null };
}

/** Prix client (devise du projet) depuis un coût converti : marge % (défaut du projet si absente) ou somme par unité. */
export function sellPrice(costBase: number | null, margin: OfferMargin, defaultPct: number): number | null {
  if (costBase == null) return null;
  if (margin.mode === 'amount') return r2(costBase + (margin.value ?? 0));
  const pct = margin.value ?? defaultPct;
  return r2(costBase * (1 + pct / 100));
}
export function marginPct(margin: OfferMargin, defaultPct: number): number | null {
  return margin.mode === 'pct' ? (margin.value ?? defaultPct) : null;
}

export interface PricedItem {
  item: OfferItem;
  qty: number | null;
  cost: number | null;
  costBase: number | null;
  sell: number | null;
  belowMin: boolean;
  /** Paliers au prix client. */
  tiersSell: { min_qty: number; cost: number; sell: number | null }[];
  /** Montant à la quantité du projet (base et options par unité) ou une fois (frais par commande). */
  totalSell: number | null;
}
/** Prix d'une offre ligne par ligne : coût usine, converti, prix client, total à la quantité du projet. */
export function priceOffer(
  offer: { items: OfferItem[]; currency: string; margin: OfferMargin },
  ctx: { base: string; rates: Rates; defaultPct: number; qtyOf: (item: OfferItem) => number | null },
): PricedItem[] {
  return offer.items.map((item) => {
    const qty = ctx.qtyOf(item);
    const { price, belowMin } = unitCostAt(item, qty);
    const costBase = toBase(price, offer.currency, ctx.base, ctx.rates);
    const sell = sellPrice(costBase, offer.margin, ctx.defaultPct);
    const once = item.kind === 'fee' && item.per === 'order';
    return {
      item,
      qty,
      cost: price,
      costBase,
      sell,
      belowMin,
      tiersSell: item.tiers.map((t) => ({ min_qty: t.min_qty, cost: t.price, sell: sellPrice(toBase(t.price, offer.currency, ctx.base, ctx.rates), offer.margin, ctx.defaultPct) })),
      totalSell: sell == null ? null : once ? sell : qty != null ? r2(sell * qty) : null,
    };
  });
}

export type OfferLayout = 'simple' | 'variants' | 'tiers' | 'variants_tiers';
/** Affichage adapté à la façon dont l'usine a envoyé son prix. */
export function offerLayout(items: { kind: OfferItemKind; variant: Record<string, string>; tiers: { min_qty: number }[] }[]): OfferLayout {
  const base = items.filter((i) => i.kind === 'base');
  const variants = new Set(base.flatMap((i) => Object.keys(i.variant))).size > 0 && base.length > 1;
  const tiers = base.some((i) => i.tiers.length > 1);
  return variants && tiers ? 'variants_tiers' : variants ? 'variants' : tiers ? 'tiers' : 'simple';
}
/** Colonnes de variantes (clés présentes sur les lignes de base), dans l'ordre d'apparition. */
export function variantKeys(items: Pick<OfferItem, 'kind' | 'variant'>[]): string[] {
  return [...new Set(items.filter((i) => i.kind === 'base').flatMap((i) => Object.keys(i.variant)))];
}
/** Seuils de quantité présents sur les lignes de base (colonnes du tableau à paliers). */
export function tierColumns(items: { kind: OfferItemKind; tiers: { min_qty: number }[] }[]): number[] {
  return [...new Set(items.filter((i) => i.kind === 'base').flatMap((i) => i.tiers.map((t) => t.min_qty)))].sort((a, b) => a - b);
}

type QtyLine = { id: string; lot: string; unit: string; effective_quantity: number; label?: string };
/** Unités équivalentes (« set » = « kit », « pcs » = « pièce », « m2 » = « m² »…) pour rapprocher offre et devis. */
export function unitKey(u: string): string {
  const k = u.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9²³]/g, '');
  if (/^(set|sets|kit|kits|ensemble|ensembles|court|courts|field|fields|terrain|terrains)$/.test(k)) return 'kit';
  if (/^(pc|pcs|piece|pieces|unit|units|unite|unites|u|ea)$/.test(k)) return 'pièce';
  if (/^(m2|m²|sqm|sq\.?m|metrecarre|metrescarres)$/.test(k)) return 'm²';
  if (/^(m3|m³|cbm)$/.test(k)) return 'm³';
  if (/^(m|ml|metre|metres|meter|meters|lm)$/.test(k)) return 'm';
  if (/^(forfait|lot|lump|lumpsum|order|commande|package)$/.test(k)) return 'forfait';
  if (/^(t|ton|tons|tonne|tonnes)$/.test(k)) return 'tonne';
  return k;
}
// Mots significatifs d'un libellé (≥ 4 lettres) + mots voisins collés (« shock pad » → « shockpad »),
// pour reconnaître les graphies en un ou deux mots.
const words = (t: string) => {
  const raw = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const out = new Set(raw.filter((w) => w.length >= 4));
  for (let i = 0; i + 1 < raw.length; i++) if (raw[i].length >= 3 && raw[i + 1].length >= 3) out.add(raw[i] + raw[i + 1]);
  return out;
};
const overlap = (a: string, b: string) => { const w = words(a); return [...words(b)].filter((x) => w.has(x)).length; };
/**
 * Ligne du devis correspondant à une ligne d'offre : ligne liée ; sinon, parmi
 * les lignes du lot d'unité équivalente, celle dont le libellé ressemble le plus
 * (gazon ≠ shockpad, tous deux en m²) ; sinon seule ligne du lot.
 * Lot sans ligne de devis (usine « set complet » qui fournit padel, foot et
 * gazon d'un coup, ou lot libre) : on cherche dans TOUTES les lignes, par unité
 * puis libellé — et seulement si le libellé correspond quand plusieurs lignes
 * ont la même unité ; jamais une ligne d'un autre lot par défaut.
 */
export function projectLine<L extends QtyLine>(item: Pick<OfferItem, 'quote_line_id' | 'unit'> & { label?: string }, lot: string, lines: L[]): L | null {
  const linked = item.quote_line_id ? lines.find((l) => l.id === item.quote_line_id) : null;
  if (linked) return linked;
  const inLot = lines.filter((l) => l.lot === lot);
  const crossLot = inLot.length === 0;
  const pool = crossLot ? lines : inLot;
  const sameUnit = pool.filter((l) => unitKey(l.unit) === unitKey(item.unit));
  if (sameUnit.length === 1 && !crossLot) return sameUnit[0];
  if (sameUnit.length >= 1) {
    if (!item.label) return crossLot ? null : sameUnit[0];
    const ranked = sameUnit.map((l) => ({ l, n: overlap(item.label || '', l.label || '') })).sort((a, b) => b.n - a.n);
    if (ranked[0].n > 0) return ranked[0].l;
    return crossLot ? null : ranked[0].l;
  }
  return inLot.length === 1 ? inLot[0] : null;
}
/** Quantité du projet pour une ligne d'offre (voir projectLine). */
export function projectQty(item: Pick<OfferItem, 'quote_line_id' | 'unit'> & { label?: string }, lot: string, lines: QtyLine[]): number | null {
  return projectLine(item, lot, lines)?.effective_quantity ?? null;
}

/** Ligne d'offre pour la comparaison : ligne du devis rattachée, prix client à la quantité du projet. */
export interface CompareItem {
  id: string;
  kind: OfferItemKind;
  label: string;
  variant: Record<string, string>;
  line_id: string | null;
  price: number | null;
  total: number | null;
}
/**
 * Comparaison d'une offre : par ligne du devis, l'alternative la moins chère
 * (parmi celles qui correspondent au filtre de variantes) ; total = somme des
 * lignes retenues + frais. Les lignes d'offre sur une même ligne du devis sont
 * des alternatives, sur des lignes différentes elles s'additionnent.
 */
export function compareOffer(items: CompareItem[], filter: Record<string, string> = {}): { byLine: Record<string, CompareItem>; fees: number; total: number | null; complete: boolean } {
  const matches = (v: Record<string, string>) => Object.entries(filter).every(([k, x]) => !x || !(k in v) || v[k] === x);
  const byLine: Record<string, CompareItem> = {};
  for (const it of items.filter((i) => i.kind === 'base' && i.line_id && i.price != null && matches(i.variant))) {
    const cur = byLine[it.line_id!];
    if (!cur || (it.price as number) < (cur.price as number)) byLine[it.line_id!] = it;
  }
  const fees = items.filter((i) => i.kind === 'fee' && i.total != null).reduce((n, i) => n + (i.total as number), 0);
  const parts = Object.values(byLine).map((i) => i.total);
  const complete = parts.every((t) => t != null);
  return { byLine, fees: r2(fees), total: parts.length && complete ? r2(parts.reduce((n, t) => n + (t as number), 0) + fees) : null, complete };
}

/** Réponse du modèle → offre extraite d'un message (null si aucun prix). */
export interface ExtractedOffer {
  currency: string;
  incoterm: string | null;
  port: string | null;
  valid_until: string | null;
  lead_time: string | null;
  moq: string | null;
  payment_terms: string | null;
  notes: string | null;
  items: OfferItem[];
}
/**
 * Offre extraite d'un message → champs d'une offre enregistrée. Le titre
 * rappelle la date de l'échange (« Prix reçus le 9 oct. 2026 ») ; la marge
 * reste celle du projet (mode %, valeur nulle).
 */
export function offerFromExtracted(o: ExtractedOffer, at?: string | null): Pick<ExtractedOffer, 'currency' | 'incoterm' | 'port' | 'valid_until' | 'lead_time' | 'moq' | 'payment_terms' | 'notes' | 'items'> & { title: string } {
  const d = at ? new Date(at) : new Date();
  const day = Number.isNaN(d.getTime()) ? new Date() : d;
  return {
    title: `Prix reçus le ${day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`,
    currency: o.currency,
    incoterm: o.incoterm,
    port: o.port,
    valid_until: o.valid_until,
    lead_time: o.lead_time,
    moq: o.moq,
    payment_terms: o.payment_terms,
    notes: o.notes,
    items: o.items,
  };
}
export function validateExtractedOffer(raw: unknown): ExtractedOffer | null {
  const o = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!o) return null;
  const items = (Array.isArray(o.items) ? o.items : []).map((x, i) => cleanItem(x, i)).filter((x): x is OfferItem => !!x).slice(0, 60);
  if (!items.length) return null;
  const cur = str(o.currency, 6).toUpperCase();
  const date = str(o.valid_until, 10);
  return {
    currency: /^[A-Z]{3}$/.test(cur) ? cur : 'USD',
    incoterm: str(o.incoterm, 12).toUpperCase() || null,
    port: str(o.port, 60) || null,
    valid_until: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    lead_time: str(o.lead_time, 80) || null,
    moq: str(o.moq, 80) || null,
    payment_terms: str(o.payment_terms, 160) || null,
    notes: str(o.notes, 600) || null,
    items,
  };
}
