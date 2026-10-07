// Achats sur place (7 oct. 2026) : un client qui vient acheter en Chine envoie
// sa liste (texte, liens, photos) ; l'équipe la regroupe en jours de visite
// (même zone, même fournisseur) ; sur place, le client coche, chiffre, note et
// photographie chaque ligne ; l'app totalise (¥ et devise locale) et suit le
// délai usine → cargo. Partie pure, testée. La base est dans data.ts.

import { LOCAL_CURRENCY } from '@/lib/local-currency';
import { FX_RATES, roundXafUp } from '@/lib/utils/formatCurrency';

export type TripStatus = 'draft' | 'submitted' | 'planned' | 'on_site' | 'done';
export type ItemStatus = 'to_buy' | 'bought' | 'skipped' | 'ordered_online';
export interface Photo {
  url: string;
  caption?: string | null;
  at?: string | null;
}
export interface BuyingTrip {
  id: string;
  title: string;
  client_name: string;
  client_phone: string;
  status: TripStatus;
  token: string;
  /** Date limite d'arrivée des marchandises au cargo (groupage). */
  cargo_cutoff: string | null;
  /** Note interne de l'équipe (jamais montrée au client). */
  notes: string | null;
  /** Message du client envoyé avec sa liste. */
  client_notes: string | null;
  /** Listing B2C dédié aux produits importés pour commande en ligne. */
  online_offer_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface BuyingDay {
  id: string;
  trip_id: string;
  position: number;
  title: string;
  visit_date: string | null;
  zone: string | null;
  notes: string | null;
}
export interface BuyingItem {
  id: string;
  trip_id: string;
  day_id: string | null;
  position: number;
  label: string;
  details: string | null;
  link: string | null;
  /** Photos envoyées avec la liste. */
  source_photos: Photo[];
  quantity: number | null;
  unit: string | null;
  // Équipe : où acheter, délai usine → cargo.
  supplier: string | null;
  zone: string | null;
  lead_time_days: number | null;
  team_note: string | null;
  // Sur place, par le client.
  status: ItemStatus;
  price_cny: number | null;
  qty_bought: number | null;
  client_note: string | null;
  photos: Photo[];
  bought_at: string | null;
  // Alternative « Prix en ligne » (produit d'un listing B2B / B2C), figée par l'équipe.
  online_product_id: string | null;
  online_variant_id: string | null;
  online_offer_id: string | null;
  online_title: string | null;
  online_image_url: string | null;
  /** Prix unitaire en yuans, marge comprise (comme une ligne de commande /offer). */
  online_price_cny: number | null;
  online_moq: number | null;
  online_note: string | null;
  online_order_id: string | null;
  online_ordered_at: string | null;
  online_qty: number | null;
  created_by: 'client' | 'team';
  created_at: string;
}

export const TRIP_STATUS: { value: TripStatus; label: string; hint: string; tone: 'slate' | 'amber' | 'blue' | 'emerald' | 'violet' }[] = [
  { value: 'draft', label: 'Liste en préparation', hint: 'Le client compose sa liste', tone: 'slate' },
  { value: 'submitted', label: 'Liste reçue', hint: 'À regrouper en jours de visite', tone: 'amber' },
  { value: 'planned', label: 'Programme prêt', hint: 'Jours de visite définis', tone: 'blue' },
  { value: 'on_site', label: 'Sur place', hint: 'Achats en cours', tone: 'emerald' },
  { value: 'done', label: 'Terminé', hint: 'Achats clôturés', tone: 'violet' },
];
export const tripStatus = (s: TripStatus) => TRIP_STATUS.find((x) => x.value === s) || TRIP_STATUS[0];
export const ITEM_STATUS: { value: ItemStatus; label: string }[] = [
  { value: 'to_buy', label: 'À acheter' },
  { value: 'bought', label: 'Acheté' },
  { value: 'skipped', label: 'Pas pris' },
  { value: 'ordered_online', label: 'Commandé en ligne' },
];
/** Une ligne se commande en ligne dès que l'équipe y a fixé un prix en ligne, tant que le voyage n'est pas clôturé. */
export const canOrderOnline = (it: Pick<BuyingItem, 'online_product_id' | 'online_price_cny'>, s: TripStatus) => s !== 'done' && !!it.online_product_id && it.online_price_cny != null;
/** Phase « liste » : le client compose sa liste, pas encore de programme. */
export const canEditList = (s: TripStatus) => s === 'draft' || s === 'submitted';
/** Le client peut ajouter, préciser et illustrer des articles tant que le voyage n'est pas clôturé (même sur place : la ligne arrive dans « Autres articles », l'équipe la place dans un jour). */
export const canAddItems = (s: TripStatus) => s !== 'done';
/** Le client renseigne ses achats une fois le programme prêt. */
export const canShop = (s: TripStatus) => s === 'planned' || s === 'on_site';

// ---- Liste collée → lignes ----
export interface ParsedLine {
  label: string;
  link: string | null;
  quantity: number | null;
  unit: string | null;
}
const UNITS = 'pcs|pi[èe]ces?|unit[ée]s?|u|m²|m2|m|ml|kg|g|l|cartons?|lots?|sets?|kits?|rouleaux?|paires?|bo[îi]tes?|sacs?|paquets?';
/**
 * Une ligne de texte par article : puces et numéros retirés, lien extrait,
 * quantité reconnue (« x3 », « 3 x », « 3 pcs », « qté 3 », « ×12 »).
 */
export function parseListText(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let s = raw.replace(/^\s*(?:[-•*–—]|\d+[.)])\s+/, '').trim();
    if (!s) continue;
    let link: string | null = null;
    const m = /https?:\/\/\S+/i.exec(s);
    if (m) {
      link = m[0].replace(/[),.;]+$/, '');
      s = s.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
    }
    let quantity: number | null = null;
    let unit: string | null = null;
    const pats: RegExp[] = [
      new RegExp(`(?:^|\\s)(?:qt[ée]|quantit[ée])\\s*:?\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})?\\b`, 'i'),
      new RegExp(`(?:^|\\s)[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})?(?=\\s|$)`, 'i'),
      new RegExp(`(?:^|\\s)(\\d+(?:[.,]\\d+)?)\\s*[x×](?=\\s|$)`, 'i'),
      new RegExp(`(?:^|\\s)(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})(?=\\s|$|[,.;])`, 'i'),
    ];
    for (const re of pats) {
      const q = re.exec(s);
      if (q) {
        quantity = Number(q[1].replace(',', '.'));
        unit = q[2] ? q[2].toLowerCase().replace(/^(pcs|pi[èe]ces?|unit[ée]s?|u)$/, 'pièce').replace(/^m2$/, 'm²') : null;
        s = s.replace(q[0], ' ').replace(/\s+/g, ' ').trim();
        break;
      }
    }
    s = s.replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').trim();
    if (!s && link) {
      try {
        const u = new URL(link);
        s = `${u.hostname.replace(/^www\./, '')}${u.pathname.length > 1 ? u.pathname.slice(0, 40) : ''}`;
      } catch {
        s = link;
      }
    }
    if (!s) continue;
    out.push({ label: s.slice(0, 160), link, quantity: quantity != null && Number.isFinite(quantity) && quantity > 0 ? quantity : null, unit });
  }
  return out;
}

// ---- Montants ----
export const LOCAL_RATE: number = FX_RATES[LOCAL_CURRENCY];
/** Quantité retenue pour le montant : achetée, sinon prévue, sinon 1. */
export const effectiveQty = (it: Pick<BuyingItem, 'quantity' | 'qty_bought'>) => (it.qty_bought != null && it.qty_bought > 0 ? it.qty_bought : it.quantity != null && it.quantity > 0 ? it.quantity : 1);
/** Montant en yuans d'une ligne achetée et chiffrée ; null sinon. */
export function itemAmount(it: Pick<BuyingItem, 'status' | 'price_cny' | 'quantity' | 'qty_bought'>): number | null {
  if (it.status !== 'bought' || it.price_cny == null || it.price_cny < 0) return null;
  return Math.round(it.price_cny * effectiveQty(it) * 100) / 100;
}
/** Prix unitaire en ligne en devise locale (arrondi commercial au 100 supérieur, comme /offer). */
export const onlineUnitLocal = (it: Pick<BuyingItem, 'online_price_cny'>, rate = LOCAL_RATE) => (it.online_price_cny == null ? null : roundXafUp(it.online_price_cny * rate));
/** Montant en yuans d'une ligne commandée en ligne (prix figé × quantité commandée) ; null sinon. */
export function onlineAmount(it: Pick<BuyingItem, 'status' | 'online_price_cny' | 'online_qty' | 'quantity'>): number | null {
  if (it.status !== 'ordered_online' || it.online_price_cny == null) return null;
  const qty = it.online_qty != null && it.online_qty > 0 ? it.online_qty : it.quantity != null && it.quantity > 0 ? it.quantity : 1;
  return Math.round(it.online_price_cny * qty * 100) / 100;
}
export interface Totals {
  items: number;
  bought: number;
  toBuy: number;
  skipped: number;
  /** Lignes commandées en ligne (réglées dans le panier /offer, transport à part). */
  ordered: number;
  /** Lignes achetées sans prix (le total est incomplet). */
  unpriced: number;
  /** Achats sur place. */
  cny: number;
  local: number;
  /** Commandes en ligne (produits, hors transport). */
  onlineCny: number;
  onlineLocal: number;
}
export function totals(items: BuyingItem[], rate = LOCAL_RATE): Totals {
  const t: Totals = { items: items.length, bought: 0, toBuy: 0, skipped: 0, ordered: 0, unpriced: 0, cny: 0, local: 0, onlineCny: 0, onlineLocal: 0 };
  for (const it of items) {
    if (it.status === 'bought') {
      t.bought++;
      const a = itemAmount(it);
      if (a == null) t.unpriced++;
      else t.cny += a;
    } else if (it.status === 'ordered_online') {
      t.ordered++;
      t.onlineCny += onlineAmount(it) ?? 0;
    } else if (it.status === 'skipped') t.skipped++;
    else t.toBuy++;
  }
  t.cny = Math.round(t.cny * 100) / 100;
  t.local = Math.round(t.cny * rate);
  t.onlineCny = Math.round(t.onlineCny * 100) / 100;
  t.onlineLocal = Math.round(t.onlineCny * rate);
  return t;
}
/** Lignes par jour (dans l'ordre des jours), puis les lignes sans jour. */
export function daySummaries(days: BuyingDay[], items: BuyingItem[], rate = LOCAL_RATE): { day: BuyingDay | null; items: BuyingItem[]; totals: Totals }[] {
  const sorted = [...days].sort((a, b) => a.position - b.position || (a.visit_date || '').localeCompare(b.visit_date || ''));
  const byDay = (id: string | null) => items.filter((i) => i.day_id === id).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  const out: { day: BuyingDay | null; items: BuyingItem[]; totals: Totals }[] = sorted.map((day) => ({ day, items: byDay(day.id), totals: totals(byDay(day.id), rate) }));
  const rest = byDay(null);
  if (rest.length || !out.length) out.push({ day: null, items: rest, totals: totals(rest, rate) });
  return out;
}

// ---- Délai usine → cargo ----
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => dayStr(new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000));
/**
 * Date à laquelle l'usine livre au cargo : date d'achat (ou aujourd'hui pour
 * une ligne à acheter) + délai annoncé. En retard si après la date limite du cargo.
 */
export function leadTime(it: Pick<BuyingItem, 'lead_time_days' | 'bought_at' | 'status'>, trip: Pick<BuyingTrip, 'cargo_cutoff'>, today = new Date()): { ready: string | null; late: boolean | null; margin_days: number | null } {
  if (it.lead_time_days == null || it.status === 'skipped') return { ready: null, late: null, margin_days: null };
  const from = it.bought_at ? it.bought_at.slice(0, 10) : dayStr(today);
  const ready = addDays(from, it.lead_time_days);
  if (!trip.cargo_cutoff) return { ready, late: null, margin_days: null };
  const margin = Math.round((Date.parse(`${trip.cargo_cutoff}T00:00:00Z`) - Date.parse(`${ready}T00:00:00Z`)) / 86_400_000);
  return { ready, late: margin < 0, margin_days: margin };
}

// ---- Regroupement par zone / fournisseur (suggestions de jours) ----
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** Lignes qui se visitent ensemble : même zone, sinon même fournisseur. Lignes déjà placées exclues. */
export function zoneGroups(items: BuyingItem[]): { key: string; label: string; item_ids: string[] }[] {
  const map = new Map<string, { label: string; item_ids: string[] }>();
  for (const it of items) {
    if (it.day_id) continue;
    const src = (it.zone || it.supplier || '').trim();
    if (!src) continue;
    const key = norm(src);
    const g = map.get(key) || { label: src, item_ids: [] };
    g.item_ids.push(it.id);
    map.set(key, g);
  }
  return [...map.entries()].map(([key, g]) => ({ key, ...g })).sort((a, b) => b.item_ids.length - a.item_ids.length || a.label.localeCompare(b.label));
}

export const fmtCny = (n: number | null | undefined) => (n == null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)} ¥`);
