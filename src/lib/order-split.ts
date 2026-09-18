// Transport fractionné d'une commande /offer : pour chaque ligne, le nombre
// d'unités qui partent en AVION (le reste part en bateau). Stocké dans
// wa_settings (clé `order_split:<orderId>`), aucune colonne, aucune migration.

import { supabaseAdmin } from '@/lib/supabase/server';

export type OrderSplit = Record<string, number>; // lineId → unités avion

export const orderSplitKey = (orderId: string) => `order_split:${orderId}`;

export function normalizeOrderSplit(raw: unknown): OrderSplit {
  const src = (raw && typeof raw === 'object' ? (raw as { lines?: unknown }).lines ?? raw : {}) as Record<string, unknown>;
  const out: OrderSplit = {};
  for (const [k, v] of Object.entries(src)) {
    const n = Number(v);
    if (typeof k === 'string' && k && Number.isFinite(n) && n >= 0) out[k] = Math.trunc(n);
  }
  return out;
}

export async function readOrderSplit(orderId: string): Promise<OrderSplit> {
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', orderSplitKey(orderId)).maybeSingle();
  return normalizeOrderSplit(data?.value);
}

export async function writeOrderSplit(orderId: string, split: OrderSplit): Promise<void> {
  await supabaseAdmin
    .from('wa_settings')
    .upsert({ key: orderSplitKey(orderId), value: { lines: normalizeOrderSplit(split) }, updated_at: new Date().toISOString() });
}

export async function clearOrderSplit(orderId: string): Promise<void> {
  await supabaseAdmin.from('wa_settings').delete().eq('key', orderSplitKey(orderId));
}
