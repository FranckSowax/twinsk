// Achats sur place › factures fournisseurs. Partie pure, testée : forme d'une
// facture lue sur photo, consigne donnée au modèle, validation de sa réponse,
// soldes et tableau de bord du voyage. La lecture de l'image et la base sont
// dans receipts-server.ts et data.ts.

import { LOCAL_RATE, type BuyingItem } from './logic';

export type ReceiptPaymentStatus = 'unknown' | 'unpaid' | 'deposit' | 'paid';
export interface ReceiptPhoto {
  url: string;
  caption?: string | null;
  at?: string | null;
}
export interface BuyingReceipt {
  id: string;
  trip_id: string;
  /** Ligne d'achat couverte (null : facture à rattacher par l'équipe). */
  item_id: string | null;
  photos: ReceiptPhoto[];
  supplier_name: string | null;
  supplier_name_zh: string | null;
  supplier_address: string | null;
  supplier_address_zh: string | null;
  supplier_contact: string | null;
  currency: string;
  /** Montant total de la commande sur la facture. */
  total_amount: number | null;
  /** Ce qui a déjà été versé (acompte ou solde). */
  paid_amount: number | null;
  /** Reste à payer, quand la facture l'écrit noir sur blanc. */
  balance_amount: number | null;
  payment_status: ReceiptPaymentStatus;
  issued_on: string | null;
  delivery_note: string | null;
  items_text: string | null;
  notes: string | null;
  raw_text: string | null;
  created_by: 'client' | 'team';
  created_at: string;
}

export const RECEIPT_STATUS: { value: ReceiptPaymentStatus; label: string; tone: 'slate' | 'amber' | 'emerald' | 'red' }[] = [
  { value: 'unknown', label: 'À préciser', tone: 'slate' },
  { value: 'unpaid', label: 'Rien versé', tone: 'red' },
  { value: 'deposit', label: 'Acompte versé', tone: 'amber' },
  { value: 'paid', label: 'Soldée', tone: 'emerald' },
];
export const receiptStatus = (s: ReceiptPaymentStatus) => RECEIPT_STATUS.find((x) => x.value === s) || RECEIPT_STATUS[0];

/** Reste à payer : celui de la facture, sinon total − versé (jamais négatif). */
export function receiptDue(r: Pick<BuyingReceipt, 'total_amount' | 'paid_amount' | 'balance_amount' | 'payment_status'>): number | null {
  if (r.payment_status === 'paid') return 0;
  if (r.balance_amount != null) return Math.max(0, Math.round(r.balance_amount * 100) / 100);
  if (r.total_amount == null) return null;
  return Math.max(0, Math.round((r.total_amount - (r.paid_amount ?? 0)) * 100) / 100);
}

/**
 * Statut déduit des montants quand le modèle n'a rien conclu : rien versé,
 * acompte, ou soldée. Un total inconnu reste « à préciser ».
 */
export function deriveStatus(total: number | null, paid: number | null): ReceiptPaymentStatus {
  if (total == null || paid == null) return 'unknown';
  if (paid <= 0) return 'unpaid';
  if (paid + 0.009 >= total) return 'paid';
  return 'deposit';
}

export interface ReceiptTotals {
  count: number;
  /** Factures soldées / avec acompte / sans versement. */
  paid: number;
  deposit: number;
  unpaid: number;
  /** Montants en yuans. */
  total: number;
  paidAmount: number;
  due: number;
  /** Factures dont le montant total n'a pas été lu (totaux incomplets). */
  unpriced: number;
  /** Reste à payer converti dans la devise locale. */
  dueLocal: number;
  totalLocal: number;
}
export function receiptTotals(receipts: BuyingReceipt[], rate = LOCAL_RATE): ReceiptTotals {
  const t: ReceiptTotals = { count: receipts.length, paid: 0, deposit: 0, unpaid: 0, total: 0, paidAmount: 0, due: 0, unpriced: 0, dueLocal: 0, totalLocal: 0 };
  for (const r of receipts) {
    if (r.payment_status === 'paid') t.paid += 1;
    else if (r.payment_status === 'deposit') t.deposit += 1;
    else if (r.payment_status === 'unpaid') t.unpaid += 1;
    if (r.total_amount == null) t.unpriced += 1;
    else t.total += r.total_amount;
    t.paidAmount += r.paid_amount ?? (r.payment_status === 'paid' ? (r.total_amount ?? 0) : 0);
    t.due += receiptDue(r) ?? 0;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  t.total = r2(t.total);
  t.paidAmount = r2(t.paidAmount);
  t.due = r2(t.due);
  t.dueLocal = Math.round(t.due * rate);
  t.totalLocal = Math.round(t.total * rate);
  return t;
}

/** Regroupement par fournisseur : qui reste à payer, combien de factures. */
export function bySupplier(receipts: BuyingReceipt[]): { key: string; name: string; address: string | null; contact: string | null; count: number; total: number; paid: number; due: number }[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9一-鿿]+/g, ' ').trim();
  const map = new Map<string, { name: string; address: string | null; contact: string | null; count: number; total: number; paid: number; due: number }>();
  for (const r of receipts) {
    const name = (r.supplier_name || r.supplier_name_zh || 'Fournisseur à préciser').trim();
    const key = norm(name) || 'x';
    const g = map.get(key) || { name, address: r.supplier_address, contact: r.supplier_contact, count: 0, total: 0, paid: 0, due: 0 };
    g.count += 1;
    g.total += r.total_amount ?? 0;
    g.paid += r.paid_amount ?? (r.payment_status === 'paid' ? (r.total_amount ?? 0) : 0);
    g.due += receiptDue(r) ?? 0;
    g.address = g.address || r.supplier_address;
    g.contact = g.contact || r.supplier_contact;
    map.set(key, g);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return [...map.entries()]
    .map(([key, g]) => ({ key, ...g, total: r2(g.total), paid: r2(g.paid), due: r2(g.due) }))
    .sort((a, b) => b.due - a.due || b.total - a.total || a.name.localeCompare(b.name));
}

export interface TripDashboard {
  /** Lignes de la liste. */
  items: number;
  bought: number;
  toBuy: number;
  skipped: number;
  ordered: number;
  /** Lignes achetées sans facture photographiée. */
  withoutReceipt: number;
  receipts: ReceiptTotals;
}
/**
 * Tableau de bord d'un voyage : ce qui reste à acheter, ce qui est acheté, et
 * côté argent ce qui est versé, ce qui reste dû et ce qui est soldé.
 */
export function tripDashboard(items: BuyingItem[], receipts: BuyingReceipt[], rate = LOCAL_RATE): TripDashboard {
  const withReceipt = new Set(receipts.map((r) => r.item_id).filter((x): x is string => !!x));
  const d: TripDashboard = { items: items.length, bought: 0, toBuy: 0, skipped: 0, ordered: 0, withoutReceipt: 0, receipts: receiptTotals(receipts, rate) };
  for (const it of items) {
    if (it.status === 'bought') {
      d.bought += 1;
      if (!withReceipt.has(it.id)) d.withoutReceipt += 1;
    } else if (it.status === 'skipped') d.skipped += 1;
    else if (it.status === 'ordered_online') d.ordered += 1;
    else d.toBuy += 1;
  }
  return d;
}

// ---- Lecture de la photo par le modèle ----
export const RECEIPT_SYSTEM_PROMPT =
  [
    "Tu lis la photo d'une facture ou d'un reçu remis par un fournisseur chinois à un acheteur étranger venu acheter sur place (souvent un reçu manuscrit sur papier rose 收据, parfois accompagné de la carte de visite du fournisseur).",
    'Lis tout ce qui est écrit, y compris le manuscrit, et réponds UNIQUEMENT par un JSON :',
    '{"supplier_name":"nom du fournisseur traduit en français (ou translittéré), null si absent",',
    '"supplier_name_zh":"le nom tel qu\'il est écrit en chinois, null si absent",',
    '"supplier_address":"adresse traduite en français, null si absente","supplier_address_zh":"adresse en chinois, null si absente",',
    '"supplier_contact":"téléphone, WeChat ou e-mail lus, null si absent",',
    '"currency":"CNY|USD|EUR… d\'après le symbole (¥ ou 元 → CNY)",',
    '"total_amount":montant total de la commande en nombre ou null,',
    '"paid_amount":montant effectivement versé (acompte 定金/订金, ou solde) en nombre ou null,',
    '"balance_amount":reste à payer (尾款/余款) écrit sur la facture, en nombre ou null,',
    '"payment_status":"paid si le document dit que tout est payé (已付清/结清), deposit si seul un acompte est versé, unpaid si rien n\'est versé, unknown si on ne peut pas trancher",',
    '"issued_on":"AAAA-MM-JJ de la facture ou null","delivery_note":"délai ou date de livraison annoncée, traduit, ou null",',
    '"items_text":"ce qui est acheté, traduit en français, une ligne par article avec quantité et prix unitaire si lisibles",',
    '"notes":"conditions utiles (emballage, livraison à l\'entrepôt, garantie…) traduites, ou null",',
    '"raw_text":"le texte lu sur le document, tel quel (chinois compris)"}',
    "Règles : ne jamais inventer un montant, un nom ou une adresse — mets null si c'est illisible ; les montants sont des nombres (1250.5, pas « ¥1,250.5 ») ; un acompte versé laisse payment_status=deposit même si le total est écrit ; si la photo ne montre pas une facture, renvoie tous les champs à null avec raw_text décrivant ce qu'on voit.",
  ].join('\n');

export interface ReceiptAnalysis {
  supplier_name: string | null;
  supplier_name_zh: string | null;
  supplier_address: string | null;
  supplier_address_zh: string | null;
  supplier_contact: string | null;
  currency: string;
  total_amount: number | null;
  paid_amount: number | null;
  balance_amount: number | null;
  payment_status: ReceiptPaymentStatus;
  issued_on: string | null;
  delivery_note: string | null;
  items_text: string | null;
  notes: string | null;
  raw_text: string | null;
}
const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\r/g, '').trim();
  return t && t.toLowerCase() !== 'null' ? t.slice(0, max) : null;
};
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s  ¥$€,]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
/** Réponse du modèle → facture exploitable (statut recoupé avec les montants). */
export function validateReceiptAnalysis(raw: unknown): ReceiptAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const cur = (str(o.currency, 6) || 'CNY').toUpperCase();
  const total = num(o.total_amount);
  const paid = num(o.paid_amount);
  const balance = num(o.balance_amount);
  const said = String(o.payment_status || '').toLowerCase();
  const status: ReceiptPaymentStatus = RECEIPT_STATUS.some((s) => s.value === said && s.value !== 'unknown')
    ? (said as ReceiptPaymentStatus)
    : deriveStatus(total, paid);
  const date = str(o.issued_on, 10);
  return {
    supplier_name: str(o.supplier_name, 160),
    supplier_name_zh: str(o.supplier_name_zh, 160),
    supplier_address: str(o.supplier_address, 300),
    supplier_address_zh: str(o.supplier_address_zh, 300),
    supplier_contact: str(o.supplier_contact, 160),
    currency: /^[A-Z]{3}$/.test(cur) ? cur : 'CNY',
    total_amount: total,
    // « Soldée » sans montant versé : c'est le total qui a été payé.
    paid_amount: paid ?? (status === 'paid' ? total : null),
    balance_amount: balance,
    payment_status: status,
    issued_on: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    delivery_note: str(o.delivery_note, 200),
    items_text: str(o.items_text, 2000),
    notes: str(o.notes, 1000),
    raw_text: str(o.raw_text, 4000),
  };
}
