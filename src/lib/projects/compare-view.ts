// Comparaison des offres côté client (7 oct. 2026) : logique pure, testée.
// Transforme les offres publiques (prix retravaillés, sous alias) en cartes par
// lot et par fabricant : lignes du devis chiffrées (variante la moins chère ou
// filtrée), total, meilleur prix, écart avec le meilleur, options et frais.
// Une offre d'un lot sans ligne de devis (« Set complet foot & padel ») est
// comparée dans chaque lot où elle chiffre une ligne, et dans sa propre section.

import { compareOffer, type CompareItem } from './offers';
import type { PublicOffer, PublicOfferItem } from './public';

export interface CompareLineRef {
  id: string;
  lot: string;
  label: string;
  short: string;
  unit: string;
  qty: number;
}
export interface CompareLineView {
  lineId: string;
  lot: string;
  label: string;
  short: string;
  unit: string;
  qty: number | null;
  price: number | null;
  subtotal: number | null;
  variant: Record<string, string>;
  /** Alternatives proposées par le fabricant sur cette ligne, en plus de celle retenue. */
  alternatives: number;
}
export interface CompareExtraView {
  label: string;
  variant: Record<string, string>;
  unit: string;
  price: number | null;
  /** Montant à la quantité du projet (option) ou une fois (frais par commande). */
  total: number | null;
  once: boolean;
}
export interface CompareOfferView {
  id: string;
  alias: string;
  score: number | null;
  interested: boolean;
  /** Offre « set complet » comparée dans un lot qui n'est pas le sien. */
  crossLot: boolean;
  lines: CompareLineView[];
  options: CompareExtraView[];
  fees: CompareExtraView[];
  total: number | null;
  complete: boolean;
  best: boolean;
  /** Écart en % avec la meilleure offre du lot (null si meilleure ou incomparable). */
  deltaPct: number | null;
  terms: { incoterm: string | null; lead_time: string | null; moq: string | null; valid_until: string | null };
}
export interface CompareLot {
  lot: string;
  /** Lot sans ligne de devis : offres d'ensemble complet, toutes lignes confondues. */
  isSet: boolean;
  offers: CompareOfferView[];
  /** Variantes qui changent vraiment quelque chose : plusieurs valeurs sur une MÊME ligne du devis. */
  variantChoices: Record<string, string[]>;
  bestTotal: number | null;
  lineCount: number;
}
export interface CompareOverview {
  lot: string;
  offers: number;
  best: { alias: string; total: number } | null;
}

/** Libellé court d'une ligne (avant la parenthèse ou le tiret long), pour les cartes. */
export function shortLabel(label: string, max = 52): string {
  const cut = label.split(/\s[(—–]\s?|\s\(/)[0].trim();
  const s = cut || label.trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Items d'une offre qui comptent dans un lot : tous si c'est le sien, sinon ceux rattachés à une ligne de ce lot (frais exclus). */
function itemsFor(o: PublicOffer, lot: string, lineLot: Map<string, string>): { items: PublicOfferItem[]; crossLot: boolean } {
  if (o.lot === lot) return { items: o.items, crossLot: false };
  return { items: o.items.filter((i) => i.kind !== 'fee' && i.line_id && lineLot.get(i.line_id) === lot), crossLot: true };
}

/** Variantes utiles au choix : au moins deux valeurs distinctes sur une même ligne du devis, parmi les offres du lot. */
export function variantChoices(itemsByOffer: PublicOfferItem[][]): Record<string, string[]> {
  const byLineKey = new Map<string, Set<string>>();
  for (const items of itemsByOffer) {
    for (const i of items) {
      if (i.kind !== 'base' || !i.line_id) continue;
      for (const [k, v] of Object.entries(i.variant)) {
        const key = `${i.line_id}|${k}`;
        byLineKey.set(key, (byLineKey.get(key) || new Set()).add(v));
      }
    }
  }
  const out: Record<string, string[]> = {};
  for (const [key, vals] of byLineKey) {
    if (vals.size < 2) continue;
    const k = key.split('|')[1];
    out[k] = [...new Set([...(out[k] || []), ...vals])];
  }
  return out;
}

export function buildComparison(
  p: { offers: PublicOffer[]; quote: { lines: { id: string; lot: string; label: string; unit: string; effective_quantity: number }[] } },
  filters: Record<string, Record<string, string>> = {},
): { lots: CompareLot[]; overview: CompareOverview[] } {
  const lines: CompareLineRef[] = p.quote.lines.map((l) => ({ id: l.id, lot: l.lot, label: l.label, short: shortLabel(l.label), unit: l.unit, qty: l.effective_quantity }));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const lineLot = new Map(lines.map((l) => [l.id, l.lot]));
  const lineOrder = new Map(lines.map((l, i) => [l.id, i]));
  const lotsWithLines = new Set(lines.map((l) => l.lot));
  const lotOrder = [...new Set([...lines.map((l) => l.lot), ...p.offers.map((o) => o.lot)])];

  const lots: CompareLot[] = [];
  for (const lot of lotOrder) {
    const parts = p.offers.map((o) => ({ o, ...itemsFor(o, lot, lineLot) })).filter((x) => x.items.some((i) => i.kind === 'base'));
    if (!parts.length) continue;
    const choices = variantChoices(parts.map((x) => x.items));
    const filter = Object.fromEntries(Object.entries(filters[lot] || {}).filter(([k, v]) => v && choices[k]?.includes(v)));
    const offers: CompareOfferView[] = parts.map(({ o, items, crossLot }) => {
      const cmp = compareOffer(items.map((i): CompareItem => ({ id: i.id, kind: i.kind, label: i.label, variant: i.variant, line_id: i.line_id, price: i.price, total: i.total })), filter);
      const byLineCount = new Map<string, number>();
      for (const i of items) if (i.kind === 'base' && i.line_id) byLineCount.set(i.line_id, (byLineCount.get(i.line_id) || 0) + 1);
      const chosen = Object.values(cmp.byLine)
        .sort((a, b) => (lineOrder.get(a.line_id!) ?? 999) - (lineOrder.get(b.line_id!) ?? 999))
        .map((c): CompareLineView => {
          const it = items.find((i) => i.id === c.id)!;
          const ref = lineById.get(c.line_id!);
          return { lineId: c.line_id!, lot: ref?.lot || lot, label: ref?.label || it.label, short: ref ? ref.short : shortLabel(it.label), unit: it.unit, qty: it.qty, price: it.price, subtotal: it.total, variant: it.variant, alternatives: Math.max(0, (byLineCount.get(c.line_id!) || 1) - 1) };
        });
      const extra = (kind: 'option' | 'fee'): CompareExtraView[] =>
        items.filter((i) => i.kind === kind).map((i) => ({ label: i.label, variant: i.variant, unit: i.unit, price: i.price, total: i.total, once: i.kind === 'fee' && i.per === 'order' }));
      return {
        id: o.id,
        alias: o.alias,
        score: o.score,
        interested: o.interested,
        crossLot,
        lines: chosen,
        options: extra('option'),
        fees: extra('fee'),
        total: cmp.total,
        complete: cmp.complete && chosen.length > 0,
        best: false,
        deltaPct: null,
        terms: { incoterm: o.incoterm, lead_time: o.lead_time, moq: o.moq, valid_until: o.valid_until },
      };
    });
    const totals = offers.map((x) => x.total).filter((t): t is number => t != null);
    const bestTotal = totals.length ? Math.min(...totals) : null;
    for (const x of offers) {
      x.best = bestTotal != null && x.total === bestTotal && offers.length > 1;
      x.deltaPct = bestTotal != null && bestTotal > 0 && x.total != null && x.total > bestTotal ? r2(((x.total - bestTotal) / bestTotal) * 100) : null;
    }
    // Meilleure offre d'abord, puis les complètes, puis par total croissant.
    offers.sort((a, b) => Number(b.best) - Number(a.best) || Number(b.complete) - Number(a.complete) || (a.total ?? Infinity) - (b.total ?? Infinity));
    lots.push({ lot, isSet: !lotsWithLines.has(lot), offers, variantChoices: choices, bestTotal, lineCount: new Set(offers.flatMap((x) => x.lines.map((l) => l.lineId))).size });
  }
  const overview: CompareOverview[] = lots.map((l) => {
    const best = l.offers.find((o) => o.total != null && o.total === l.bestTotal) || null;
    return { lot: l.lot, offers: l.offers.length, best: best && best.total != null ? { alias: best.alias, total: best.total } : null };
  });
  return { lots, overview };
}
