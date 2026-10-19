import { describe, expect, it } from 'vitest';
import { bySupplier, deriveStatus, receiptDue, receiptTotals, tripDashboard, validateReceiptAnalysis, type BuyingReceipt } from './receipts';
import type { BuyingItem } from './logic';

const receipt = (x: Partial<BuyingReceipt> & { id: string }): BuyingReceipt => ({
  trip_id: 't', item_id: null, photos: [], supplier_name: null, supplier_name_zh: null, supplier_address: null, supplier_address_zh: null,
  supplier_contact: null, currency: 'CNY', total_amount: null, paid_amount: null, balance_amount: null, payment_status: 'unknown',
  issued_on: null, delivery_note: null, items_text: null, notes: null, raw_text: null, created_by: 'client', created_at: '2026-10-19T08:00:00Z', ...x,
});
const item = (x: Partial<BuyingItem> & { id: string; label: string }): BuyingItem => ({
  trip_id: 't', day_id: null, parent_id: null, position: 0, details: null, link: null, source_photos: [], quantity: null, unit: null,
  supplier: null, zone: null, lead_time_days: null, team_note: null, status: 'to_buy', price_cny: null, qty_bought: null, client_note: null,
  photos: [], bought_at: null, online_product_id: null, online_variant_id: null, online_offer_id: null, online_title: null,
  online_image_url: null, online_price_cny: null, online_moq: null, online_note: null, online_order_id: null, online_ordered_at: null,
  online_qty: null, created_by: 'client', created_at: '2026-10-19T08:00:00Z', ...x,
});

describe('factures fournisseurs : acompte, solde et reste à payer', () => {
  it('reste à payer : celui de la facture, sinon total − versé ; soldée = 0', () => {
    expect(receiptDue(receipt({ id: 'a', total_amount: 10000, paid_amount: 3000, payment_status: 'deposit' }))).toBe(7000);
    expect(receiptDue(receipt({ id: 'b', total_amount: 10000, paid_amount: 3000, balance_amount: 6800, payment_status: 'deposit' }))).toBe(6800);
    expect(receiptDue(receipt({ id: 'c', total_amount: 10000, paid_amount: 10000, payment_status: 'paid' }))).toBe(0);
    // Soldée sans montants lisibles : rien ne reste dû.
    expect(receiptDue(receipt({ id: 'd', payment_status: 'paid' }))).toBe(0);
    expect(receiptDue(receipt({ id: 'e' }))).toBeNull();
    expect(deriveStatus(10000, 0)).toBe('unpaid');
    expect(deriveStatus(10000, 4000)).toBe('deposit');
    expect(deriveStatus(10000, 10000)).toBe('paid');
    expect(deriveStatus(null, 500)).toBe('unknown');
  });

  it('totaux : versé, reste dû, factures sans montant signalées', () => {
    const rs = [
      receipt({ id: 'a', total_amount: 10000, paid_amount: 3000, payment_status: 'deposit' }),
      receipt({ id: 'b', total_amount: 2500, paid_amount: 2500, payment_status: 'paid' }),
      receipt({ id: 'c', payment_status: 'unknown' }),
    ];
    expect(receiptTotals(rs, 91)).toMatchObject({ count: 3, deposit: 1, paid: 1, total: 12500, paidAmount: 5500, due: 7000, unpriced: 1, dueLocal: 637000 });
  });

  it('par fournisseur : ce qui reste dû en premier, contacts repris', () => {
    const g = bySupplier([
      receipt({ id: 'a', supplier_name: 'Atelier Lin', supplier_address: 'Foshan', total_amount: 10000, paid_amount: 3000, payment_status: 'deposit' }),
      receipt({ id: 'b', supplier_name: 'atelier  lin', supplier_contact: '+86 139…', total_amount: 2000, paid_amount: 2000, payment_status: 'paid' }),
      receipt({ id: 'c', supplier_name: 'Wang Trading', total_amount: 800, paid_amount: 800, payment_status: 'paid' }),
    ]);
    expect(g.map((x) => [x.name, x.count, x.total, x.due])).toEqual([['Atelier Lin', 2, 12000, 7000], ['Wang Trading', 1, 800, 0]]);
    expect(g[0]).toMatchObject({ address: 'Foshan', contact: '+86 139…' });
  });

  it('tableau de bord : achats faits, restants, et achats sans facture', () => {
    const items = [
      item({ id: '1', label: 'Carreaux', status: 'bought' }),
      item({ id: '2', label: 'Lavabo', status: 'bought' }),
      item({ id: '3', label: 'Chaises' }),
      item({ id: '4', label: 'Lampe', status: 'skipped' }),
    ];
    const d = tripDashboard(items, [receipt({ id: 'a', item_id: '1', total_amount: 500, paid_amount: 500, payment_status: 'paid' })], 91);
    expect(d).toMatchObject({ items: 4, bought: 2, toBuy: 1, skipped: 1, withoutReceipt: 1 });
    expect(d.receipts.due).toBe(0);
  });
});

describe('factures fournisseurs : lecture de la photo', () => {
  it('montants nettoyés, statut recoupé, devise par défaut en yuans', () => {
    const r = validateReceiptAnalysis({
      supplier_name: ' Atelier Lin ', supplier_name_zh: '林氏家具厂', supplier_address: 'Foshan, Guangdong',
      supplier_contact: '+86 139 0000 0000', currency: 'cny', total_amount: '¥12,500.00', paid_amount: '3 000',
      balance_amount: null, payment_status: 'DEPOSIT', issued_on: '2026-10-18', items_text: '12 chaises', raw_text: '收据…',
    })!;
    expect(r).toMatchObject({ supplier_name: 'Atelier Lin', currency: 'CNY', total_amount: 12500, paid_amount: 3000, payment_status: 'deposit', issued_on: '2026-10-18' });
    // « Soldée » sans montant versé : le total est réputé payé.
    expect(validateReceiptAnalysis({ total_amount: 900, payment_status: 'paid' })!.paid_amount).toBe(900);
    // Statut absent : déduit des montants.
    expect(validateReceiptAnalysis({ total_amount: 900, paid_amount: 200 })!.payment_status).toBe('deposit');
    expect(validateReceiptAnalysis({ issued_on: 'hier' })!.issued_on).toBeNull();
    expect(validateReceiptAnalysis(null)).toBeNull();
  });
});
