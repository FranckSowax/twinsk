import { describe, expect, it } from 'vitest';
import { diffPriceChanges, lastGlobalMargin, touchesPrice, type PriceHistoryRow } from './price-history';

const prod = { id: 'p1', title: 'Vernis', price: 6.5, margin_percent: 30, variants: [{ id: 'v1', name: 'Rouge', price: 6.5 }, { id: 'v2', name: 'Bleu', price: 7 }] };

describe('diffPriceChanges — historique des marges et des prix (29 sept. 2026)', () => {
  it('marge et prix modifiés : ancienne et nouvelle valeur', () => {
    expect(diffPriceChanges(prod, { margin_percent: 35, price: '7.2' })).toEqual([
      { product_id: 'p1', product_title: 'Vernis', variant_name: null, field: 'margin_percent', old_value: 30, new_value: 35 },
      { product_id: 'p1', product_title: 'Vernis', variant_name: null, field: 'price', old_value: 6.5, new_value: 7.2 },
    ]);
  });
  it('valeur identique ou champ sans rapport : rien à consigner', () => {
    expect(diffPriceChanges(prod, { margin_percent: 30, price: 6.5, weight: 2 })).toEqual([]);
    expect(touchesPrice({ weight: 2 })).toBe(false);
    expect(touchesPrice({ margin_percent: 1 })).toBe(true);
  });
  it('prix de variante : seulement les variantes existantes dont le prix change', () => {
    const r = diffPriceChanges(prod, { variants: [{ id: 'v1', name: 'Rouge', price: 6.5 }, { id: 'v2', name: 'Bleu', price: 8 }, { id: 'v3', name: 'Vert', price: 9 }] });
    expect(r).toEqual([{ product_id: 'p1', product_title: 'Vernis', variant_name: 'Bleu', field: 'variant_price', old_value: 7, new_value: 8 }]);
  });
});

describe('lastGlobalMargin — marge enregistrée du listing', () => {
  const row = (o: Partial<PriceHistoryRow>): PriceHistoryRow => ({ id: Math.random().toString(), scope: 'offer', target_id: 't', product_id: 'p', product_title: null, field: 'margin_percent', variant_name: null, old_value: 30, new_value: 35, batch_id: null, batch_size: null, actor: 'Admin', created_at: '2026-09-29T10:00:00Z', ...o });
  it('« Appliquer à tous » enregistré : la plus récente l’emporte', () => {
    const rows = [row({ field: 'global_margin', product_id: null, new_value: 40, created_at: '2026-09-29T12:00:00Z' }), row({ field: 'global_margin', product_id: null, new_value: 35, created_at: '2026-09-29T11:00:00Z' })];
    expect(lastGlobalMargin(rows)).toEqual({ value: 40, at: '2026-09-29T12:00:00Z', actor: 'Admin' });
  });
  it('repli : lot de marges identiques sur plusieurs produits ; un seul produit ne compte pas', () => {
    expect(lastGlobalMargin([row({ batch_id: 'b', batch_size: 3 }), row({ batch_id: 'b', batch_size: 3 })])?.value).toBe(35);
    expect(lastGlobalMargin([row({})])).toBeNull();
  });
});
