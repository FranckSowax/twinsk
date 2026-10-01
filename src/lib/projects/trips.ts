// Voyages d'audit et rapport final construits depuis les commandes (1er oct. 2026).
// Logique pure : partagée par le serveur (nettoyage, projection client) et
// l'interface (ajout des usines des commandes, éléments du rapport).
import type { ChecklistItem } from './types';

export type TripStatus = 'draft' | 'proposed' | 'confirmed' | 'done';
export const TRIP_STATUSES: TripStatus[] = ['draft', 'proposed', 'confirmed', 'done'];
export const TRIP_STATUS_LABEL: Record<TripStatus, string> = { draft: 'Brouillon (équipe)', proposed: 'Proposé au client', confirmed: 'Confirmé', done: 'Effectué' };
/** Formulation pour le client (notifications, badge). */
export const TRIP_STATUS_CLIENT: Record<TripStatus, string> = { draft: '', proposed: 'proposé, à consulter', confirmed: 'confirmé', done: 'effectué' };

/** Étape d'un voyage : en général une usine visitée pour les commandes qui la concernent. */
export interface TripStop {
  id: string;
  day: number | null;
  date: string | null;
  city: string;
  supplier_id: string | null;
  order_ids: string[];
  line_ids: string[];
  program: string;
  /** Note interne (contact sur place, adresse…) : jamais montrée au client. */
  internal_note: string;
}

export interface RawTrip {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  stops: TripStop[];
  internal_note: string | null;
  interested_at: string | null;
  interested_by: string | null;
  quote_requested_at: string | null;
  quote_requested_by: string | null;
  created_at: string;
}

/** Voyage tel que le client le voit : alias des usines, jamais d'identifiant ni de note interne. */
export interface PublicTrip {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  stops: { id: string; day: number | null; date: string | null; city: string; alias: string | null; lot: string | null; items: string[]; orders: string[]; program: string }[];
  interested_at: string | null;
  quote_requested_at: string | null;
}

/** Élément du rapport final, éventuellement rattaché à une commande. */
export type ReportItem = ChecklistItem & { order_id?: string | null };

export interface OrderLike { id: string; reference: string; lines: string[] }
export interface LineLike { id: string; label: string; lot: string; phase: string | null }
export interface SupplierLike { id: string; alias: string; lot: string; real_name?: string | null; city?: string | null }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))] : []);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const cleanDate = (v: unknown): string | null => (typeof v === 'string' && DATE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
const rid = () => Math.random().toString(36).slice(2, 10);

export function cleanStop(raw: unknown): TripStop | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const day = Number(o.day);
  const stop: TripStop = {
    id: str(o.id, 40) || rid(),
    day: Number.isInteger(day) && day >= 1 && day <= 60 ? day : null,
    date: cleanDate(o.date),
    city: str(o.city, 80),
    supplier_id: str(o.supplier_id, 40) || null,
    order_ids: ids(o.order_ids),
    line_ids: ids(o.line_ids),
    program: str(o.program, 1000),
    internal_note: str(o.internal_note, 1000),
  };
  return stop.city || stop.supplier_id || stop.program || stop.order_ids.length ? stop : null;
}
export const cleanStops = (raw: unknown): TripStop[] => (Array.isArray(raw) ? raw.map(cleanStop).filter((s): s is TripStop => !!s).slice(0, 60) : []);

/** Ordre d'affichage : jour, puis date, puis ordre de saisie. */
export function sortStops(stops: TripStop[]): TripStop[] {
  return stops.map((s, i) => ({ s, i })).sort((a, b) => (a.s.day ?? 999) - (b.s.day ?? 999) || (a.s.date || '9').localeCompare(b.s.date || '9') || a.i - b.i).map((x) => x.s);
}

/**
 * Ajoute au voyage les usines des commandes choisies : une étape par usine
 * (ou par lot quand la ligne n'a pas d'usine), complétée si elle existe déjà.
 * Les nouvelles étapes prennent les jours suivants ; ville et programme sont
 * pré-remplis et restent modifiables.
 */
export function stopsFromOrders(
  existing: TripStop[],
  orders: OrderLike[],
  lines: LineLike[],
  lineSupplier: Record<string, string | null>,
  suppliers: SupplierLike[],
): TripStop[] {
  const out = existing.map((s) => ({ ...s, order_ids: [...s.order_ids], line_ids: [...s.line_ids] }));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const supById = new Map(suppliers.map((s) => [s.id, s]));
  let nextDay = Math.max(0, ...out.map((s) => s.day || 0)) + 1;
  for (const o of orders) {
    for (const lid of o.lines) {
      const l = lineById.get(lid);
      if (!l) continue;
      const sid = lineSupplier[lid] || null;
      const sup = sid ? supById.get(sid) : undefined;
      let stop = sid ? out.find((s) => s.supplier_id === sid) : out.find((s) => !s.supplier_id && s.line_ids.some((x) => lineById.get(x)?.lot === l.lot));
      if (!stop) {
        stop = { id: rid(), day: nextDay++, date: null, city: sup?.city || '', supplier_id: sup ? sup.id : null, order_ids: [], line_ids: [], program: '', internal_note: '' };
        out.push(stop);
      }
      if (!stop.order_ids.includes(o.id)) stop.order_ids.push(o.id);
      if (!stop.line_ids.includes(lid)) stop.line_ids.push(lid);
    }
  }
  // Programme proposé pour les étapes sans programme saisi.
  return out.map((s) => {
    if (s.program) return s;
    const labels = s.line_ids.map((x) => lineById.get(x)?.label).filter(Boolean);
    if (!labels.length) return s;
    const who = s.supplier_id ? `Usine ${supById.get(s.supplier_id)?.alias || ''}`.trim() : `Usine du lot ${lineById.get(s.line_ids[0])?.lot || ''}`.trim();
    return { ...s, program: `${who} : contrôle de la production (${labels.join(', ')}), qualité, emballage et calendrier d’expédition.` };
  });
}

/** Commandes déjà couvertes par un voyage (pour ne proposer que les autres). */
export const ordersInTrips = (trips: { stops: TripStop[] }[]) => new Set(trips.flatMap((t) => t.stops.flatMap((s) => s.order_ids)));

/**
 * Éléments du rapport final pour les commandes qui n'en ont pas encore : un
 * élément par commande, rangé dans le rapport de la phase de ses lignes
 * (première phase à défaut). Rend les rapports modifiés seulement.
 */
export function reportItemsFromOrders(
  reports: { phase: string; checklist: ReportItem[] }[],
  orders: OrderLike[],
  lines: LineLike[],
): { phase: string; checklist: ReportItem[] }[] {
  if (!reports.length) return [];
  const covered = new Set(reports.flatMap((r) => r.checklist.map((c) => c.order_id).filter(Boolean)));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const added = new Map<string, ReportItem[]>();
  for (const o of [...orders].reverse()) {
    if (covered.has(o.id)) continue;
    const ls = o.lines.map((x) => lineById.get(x)).filter((l): l is LineLike => !!l);
    const phase = reports.find((r) => ls.some((l) => l.phase === r.phase))?.phase || reports[0].phase;
    const labels = ls.map((l) => l.label);
    const item: ReportItem = { id: `o-${o.id.slice(0, 8)}-${rid()}`, label: `Commande ${o.reference}${labels.length ? ` (${labels.join(', ')})` : ''} : rapport d’inspection, photos et certificats`, done: false, order_id: o.id };
    added.set(phase, [...(added.get(phase) || []), item]);
  }
  return reports.filter((r) => added.has(r.phase)).map((r) => ({ phase: r.phase, checklist: [...r.checklist, ...added.get(r.phase)!] }));
}

export function cleanReportItems(raw: unknown): ReportItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as Record<string, unknown>;
      const label = str(o.label, 300);
      if (!label) return null;
      const item: ReportItem = { id: str(o.id, 60) || rid(), label, done: o.done === true };
      const oid = str(o.order_id, 40);
      if (oid) item.order_id = oid;
      return item;
    })
    .filter((x): x is ReportItem => !!x)
    .slice(0, 100);
}

/** Projection client : voyages proposés seulement, usines sous alias, ni identifiant ni note interne. */
export function publicTrips(trips: RawTrip[], suppliers: SupplierLike[], lines: LineLike[], orders: OrderLike[]): PublicTrip[] {
  const supById = new Map(suppliers.map((s) => [s.id, s]));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  return trips
    .filter((t) => t.status !== 'draft')
    .map((t) => ({
      id: t.id,
      title: t.title,
      start_date: t.start_date,
      end_date: t.end_date,
      status: t.status,
      stops: sortStops(t.stops).map((s) => {
        const sup = s.supplier_id ? supById.get(s.supplier_id) : undefined;
        return {
          id: s.id,
          day: s.day,
          date: s.date,
          city: s.city,
          alias: sup?.alias || null,
          lot: sup?.lot || lineById.get(s.line_ids[0])?.lot || null,
          items: s.line_ids.map((x) => lineById.get(x)?.label).filter((x): x is string => !!x),
          orders: s.order_ids.map((x) => orderById.get(x)?.reference).filter((x): x is string => !!x),
          program: s.program,
        };
      }),
      interested_at: t.interested_at,
      quote_requested_at: t.quote_requested_at,
    }));
}
