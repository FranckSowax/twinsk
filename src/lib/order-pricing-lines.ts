// Lignes d'une commande prêtes pour computeOrderPricing : poids / volume /
// batterie résolus depuis le snapshot de ligne, sinon la variante, sinon le
// produit. Factorisé depuis les routes transport / commande / promo.

import { supabaseAdmin } from '@/lib/supabase/server';
import type { OrderLineForPricing } from '@/lib/offer-pricing';

interface LineRow {
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price_cny: number;
  weight?: number | null;
  volume?: number | null;
  has_battery?: boolean | null;
}
interface Vari { id?: string; weight?: number | null; volume?: number | null }
interface ProductMeta { id: string; weight: number | null; volume: number | null; has_battery: boolean; variants: Vari[] | null }

export async function loadOrderPricingLines(orderId: string): Promise<OrderLineForPricing[]> {
  const { data: lines } = await supabaseAdmin.from('offer_order_lines').select('*').eq('order_id', orderId);
  const rows = (lines || []) as LineRow[];
  const ids = Array.from(new Set(rows.map((l) => l.product_id).filter(Boolean))) as string[];
  const { data: prods } = ids.length
    ? await supabaseAdmin.from('offer_products').select('id, weight, volume, has_battery, variants').in('id', ids)
    : { data: [] as ProductMeta[] };
  const pm = new Map<string, ProductMeta>(((prods || []) as ProductMeta[]).map((p) => [p.id, p]));
  return rows.map((l) => {
    const meta = l.product_id ? pm.get(l.product_id) : undefined;
    const vari = l.variant_id && Array.isArray(meta?.variants) ? meta!.variants.find((v) => v.id === l.variant_id) : undefined;
    return {
      unit_price_cny: l.unit_price_cny,
      quantity: l.quantity,
      weight: l.weight ?? vari?.weight ?? meta?.weight ?? null,
      volume: l.volume ?? vari?.volume ?? meta?.volume ?? null,
      has_battery: l.has_battery ?? !!meta?.has_battery,
    };
  });
}
