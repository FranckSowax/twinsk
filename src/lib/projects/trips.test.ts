import { describe, expect, it } from 'vitest';
import { cleanReportItems, cleanStops, ordersInTrips, publicTrips, reportItemsFromOrders, sortStops, stopsFromOrders, type RawTrip } from './trips';

const lines = [
  { id: 'l1', label: 'Gazon non-infill', lot: 'Gazon', phase: 'phase-1' },
  { id: 'l2', label: 'Shockpad', lot: 'Gazon', phase: 'phase-1' },
  { id: 'l3', label: 'Structures padel', lot: 'Padel', phase: 'phase-2' },
  { id: 'l4', label: 'Cages', lot: 'Cages', phase: null },
];
const suppliers = [
  { id: 's1', alias: 'Fournisseur A', lot: 'Gazon', real_name: 'Taishan Turf', city: 'Taishan' },
  { id: 's2', alias: 'Fournisseur B', lot: 'Padel', real_name: 'Padel Co', city: 'Tianjin' },
];
const lineSupplier = { l1: 's1', l2: 's1', l3: 's2', l4: null };
const orders = [
  { id: 'o2', reference: 'CMD-002', lines: ['l3', 'l4'] },
  { id: 'o1', reference: 'CMD-001', lines: ['l1', 'l2'] },
];

describe('voyages construits depuis les commandes', () => {
  it('une étape par usine, jours suivants, ville et programme pré-remplis', () => {
    const stops = stopsFromOrders([], orders, lines, lineSupplier, suppliers);
    expect(stops.map((s) => [s.day, s.supplier_id, s.city, s.line_ids.join('+'), s.order_ids.join('+')])).toEqual([
      [1, 's2', 'Tianjin', 'l3', 'o2'],
      [2, null, '', 'l4', 'o2'],
      [3, 's1', 'Taishan', 'l1+l2', 'o1'],
    ]);
    expect(stops[2].program).toContain('Usine Fournisseur A');
    expect(stops[2].program).toContain('Gazon non-infill, Shockpad');
    expect(stops[1].program).toContain('lot Cages');
  });
  it('complète une étape existante sans écraser le programme saisi', () => {
    const existing = cleanStops([{ id: 'x', day: 4, city: 'Guangzhou', supplier_id: 's1', order_ids: ['o9'], line_ids: [], program: 'Visite libre' }]);
    const stops = stopsFromOrders(existing, [orders[1]], lines, lineSupplier, suppliers);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatchObject({ day: 4, city: 'Guangzhou', program: 'Visite libre', order_ids: ['o9', 'o1'], line_ids: ['l1', 'l2'] });
    expect(ordersInTrips([{ stops }])).toEqual(new Set(['o9', 'o1']));
  });
  it('nettoyage et tri des étapes', () => {
    const s = cleanStops([{ day: 0, city: ' Canton ', date: '2026-11-03T00:00', order_ids: ['a', 'a', 3] }, { foo: 1 }, null, { day: 2, program: 'p' }]);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ day: null, city: 'Canton', date: '2026-11-03', order_ids: ['a'] });
    expect(sortStops(s).map((x) => x.day)).toEqual([2, null]);
  });
});

describe('rapport final depuis les commandes', () => {
  const reports = [{ phase: 'phase-1', checklist: [] }, { phase: 'phase-2', checklist: [{ id: 'm', label: 'DOE', done: true }] }];
  it('un élément par commande, dans la phase de ses lignes, sans doublon', () => {
    const next = reportItemsFromOrders(reports, orders, lines);
    expect(next.map((r) => [r.phase, r.checklist.map((c) => c.order_id || c.id)])).toEqual([
      ['phase-1', ['o1']],
      ['phase-2', ['m', 'o2']],
    ]);
    expect(next[0].checklist[0].label).toBe('Commande CMD-001 (Gazon non-infill, Shockpad) : rapport d’inspection, photos et certificats');
    const again = reportItemsFromOrders(next.concat(), orders, lines);
    expect(again).toEqual([]);
  });
  it('nettoyage des éléments saisis', () => {
    expect(cleanReportItems([{ label: '  ', done: true }, { id: 'a', label: 'Photos', done: 'oui', order_id: 'o1' }, 'x'])).toEqual([{ id: 'a', label: 'Photos', done: false, order_id: 'o1' }]);
  });
});

describe('projection client des voyages', () => {
  const trip = (status: RawTrip['status']): RawTrip => ({
    id: 't-' + status, title: 'Audit usines', start_date: '2026-11-02', end_date: null, status,
    stops: [{ id: 's', day: 1, date: null, city: 'Tianjin', supplier_id: 's2', order_ids: ['o2'], line_ids: ['l3'], program: 'Contrôle', internal_note: 'M. Li 138…' }],
    internal_note: 'budget serré', interested_at: null, interested_by: null, quote_requested_at: null, quote_requested_by: null, created_at: '2026-10-01',
  });
  it('brouillons masqués, alias seulement, ni note interne ni identifiant usine', () => {
    const v = publicTrips([trip('draft'), trip('proposed')], suppliers, lines, orders);
    expect(v).toHaveLength(1);
    expect(v[0].stops[0]).toEqual({ id: 's', day: 1, date: null, city: 'Tianjin', alias: 'Fournisseur B', lot: 'Padel', items: ['Structures padel'], orders: ['CMD-002'], program: 'Contrôle' });
    const json = JSON.stringify(v);
    for (const secret of ['Padel Co', 'M. Li', 'budget', 's2', 'internal_note', 'supplier_id']) expect(json).not.toContain(secret);
  });
});
