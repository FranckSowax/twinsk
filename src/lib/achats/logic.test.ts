import { describe, expect, it } from 'vitest';
import { addDays, daySummaries, itemAmount, leadTime, onlineAmount, onlineUnitLocal, parseListText, totals, zoneGroups, type BuyingDay, type BuyingItem } from './logic';

const item = (x: Partial<BuyingItem> & { id: string; label: string }): BuyingItem => ({ trip_id: 't', day_id: null, parent_id: null, position: 0, details: null, link: null, source_photos: [], quantity: null, unit: null, supplier: null, zone: null, lead_time_days: null, team_note: null, status: 'to_buy', price_cny: null, qty_bought: null, client_note: null, photos: [], bought_at: null, online_product_id: null, online_variant_id: null, online_offer_id: null, online_title: null, online_image_url: null, online_price_cny: null, online_moq: null, online_note: null, online_order_id: null, online_ordered_at: null, online_qty: null, created_by: 'client', created_at: '2026-10-07T00:00:00Z', ...x });

describe('achats sur place : liste collée', () => {
  it('une ligne par article, puces retirées, lien extrait, quantité reconnue', () => {
    const lines = parseListText(['- Carreaux 60x60 blanc x 120', '2. Lavabo double vasque https://detail.1688.com/offer/123.html', 'Canapé d’angle 3 pcs', 'qté 12 chaises', '', 'https://www.alibaba.com/product/abc', '• Robinetterie ×6'].join('\n'));
    expect(lines).toEqual([
      { label: 'Carreaux 60x60 blanc', link: null, quantity: 120, unit: null },
      { label: 'Lavabo double vasque', link: 'https://detail.1688.com/offer/123.html', quantity: null, unit: null },
      { label: 'Canapé d’angle', link: null, quantity: 3, unit: 'pièce' },
      { label: 'chaises', link: null, quantity: 12, unit: null },
      { label: 'alibaba.com/product/abc', link: 'https://www.alibaba.com/product/abc', quantity: null, unit: null },
      { label: 'Robinetterie', link: null, quantity: 6, unit: null },
    ]);
  });
});

describe('achats sur place : montants et jours', () => {
  const items = [
    item({ id: 'a', label: 'Carreaux', status: 'bought', price_cny: 35, qty_bought: 120, day_id: 'd1' }),
    item({ id: 'b', label: 'Lavabo', status: 'bought', price_cny: 480, quantity: 2, day_id: 'd1' }),
    item({ id: 'c', label: 'Canapé', status: 'bought', price_cny: null, day_id: 'd2' }),
    item({ id: 'd', label: 'Chaises', status: 'to_buy', quantity: 12 }),
    item({ id: 'e', label: 'Lampe', status: 'skipped', day_id: 'd2' }),
    // Commandée en ligne : 12,5 ¥ marge comprise × 40 = 500 ¥, à part des achats sur place.
    item({ id: 'f', label: 'Interrupteurs', status: 'ordered_online', online_product_id: 'p1', online_price_cny: 12.5, online_qty: 40, quantity: 50 }),
  ];
  it('montant = prix × quantité achetée (sinon prévue, sinon 1) ; seulement les lignes achetées', () => {
    expect(itemAmount(items[0])).toBe(4200);
    expect(itemAmount(items[1])).toBe(960);
    expect(itemAmount(items[2])).toBeNull();
    expect(itemAmount(items[3])).toBeNull();
  });
  it('totaux en yuans et en devise locale, lignes achetées sans prix signalées', () => {
    expect(totals(items, 91)).toEqual({ items: 6, bought: 3, toBuy: 1, skipped: 1, ordered: 1, unpriced: 1, cny: 5160, local: 469560, onlineCny: 500, onlineLocal: 45500 });
    expect(onlineAmount(items[5])).toBe(500);
    expect(onlineUnitLocal(items[5], 91)).toBe(1200); // 1 137,5 FCFA arrondis au 100 supérieur
  });
  it('résumé par jour dans l’ordre, lignes sans jour à la fin', () => {
    const days: BuyingDay[] = [{ id: 'd2', trip_id: 't', position: 2, title: 'Jour 2 — Mobilier', visit_date: null, zone: null, notes: null }, { id: 'd1', trip_id: 't', position: 1, title: 'Jour 1 — Carreaux et sanitaire', visit_date: '2026-11-03', zone: 'Foshan', notes: null }];
    const s = daySummaries(days, items, 91);
    expect(s.map((x) => [x.day?.title ?? null, x.items.map((i) => i.id), x.totals.cny])).toEqual([
      ['Jour 1 — Carreaux et sanitaire', ['a', 'b'], 5160],
      ['Jour 2 — Mobilier', ['c', 'e'], 0],
      [null, ['d', 'f'], 0],
    ]);
  });
});

describe('achats sur place : délai usine → cargo et zones', () => {
  it('date de livraison = achat + délai ; retard si après la date limite du cargo', () => {
    expect(addDays('2026-11-03', 15)).toBe('2026-11-18');
    const trip = { cargo_cutoff: '2026-11-20' };
    expect(leadTime(item({ id: 'a', label: 'x', lead_time_days: 15, bought_at: '2026-11-03T10:00:00Z', status: 'bought' }), trip)).toEqual({ ready: '2026-11-18', late: false, margin_days: 2 });
    expect(leadTime(item({ id: 'b', label: 'x', lead_time_days: 25, bought_at: '2026-11-03T10:00:00Z', status: 'bought' }), trip)).toEqual({ ready: '2026-11-28', late: true, margin_days: -8 });
    expect(leadTime(item({ id: 'c', label: 'x', lead_time_days: 10 }), trip, new Date('2026-11-05T00:00:00Z'))).toEqual({ ready: '2026-11-15', late: false, margin_days: 5 });
    expect(leadTime(item({ id: 'd', label: 'x' }), trip)).toEqual({ ready: null, late: null, margin_days: null });
  });
  it('suggestions de jours : même zone (sinon fournisseur), lignes déjà placées exclues, plus grand groupe d’abord', () => {
    const g = zoneGroups([
      item({ id: '1', label: 'Carreaux', zone: 'Foshan' }),
      item({ id: '2', label: 'Sanitaire', zone: 'foshan ' }),
      item({ id: '3', label: 'Canapé', supplier: 'Lecong Furniture' }),
      item({ id: '4', label: 'Lampe', zone: 'Zhongshan', day_id: 'd1' }),
      item({ id: '5', label: 'Chaises' }),
    ]);
    expect(g).toEqual([{ key: 'foshan', label: 'Foshan', item_ids: ['1', '2'] }, { key: 'lecong furniture', label: 'Lecong Furniture', item_ids: ['3'] }]);
  });
});

describe('achats sur place : sous-lignes', () => {
  const items = [
    item({ id: 'p', label: 'Packaging cadeaux', day_id: 'd1', source_photos: [] }),
    item({ id: 'p1', label: 'Packaging cadeaux — 1', parent_id: 'p', day_id: 'd1', status: 'bought', price_cny: 8, qty_bought: 500 }),
    item({ id: 'p2', label: 'Packaging cadeaux — 2', parent_id: 'p', day_id: 'd1', status: 'skipped' }),
    item({ id: 'x', label: 'Lampadaire', day_id: 'd1', status: 'bought', price_cny: 300, qty_bought: 2 }),
  ];
  it('le parent est un en-tête : seules les sous-lignes comptent dans les totaux', () => {
    expect(totals(items, 91)).toMatchObject({ items: 3, bought: 2, skipped: 1, cny: 4600, local: 418600 });
  });
  it('par jour : articles de premier niveau seulement, totaux avec les sous-lignes', () => {
    const days: BuyingDay[] = [{ id: 'd1', trip_id: 't', position: 1, title: 'Jour 1', visit_date: null, zone: null, notes: null }];
    const s = daySummaries(days, items, 91);
    expect(s.map((x) => [x.day?.title ?? null, x.items.map((i) => i.id), x.totals.cny])).toEqual([['Jour 1', ['p', 'x'], 4600]]);
  });
});
