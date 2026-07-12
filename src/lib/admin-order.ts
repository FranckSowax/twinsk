import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/offer-pricing';
import { roundXafUp } from '@/lib/utils/formatCurrency';

// Recalcule et persiste les totaux d'une commande /offer à partir de ses lignes
// (poids/volume/batterie stockés sur offer_order_lines) et du mode de transport.
// Utilisé après toute édition admin (infos, lignes, poids/volume…).
export async function recomputeOrder(orderId: string): Promise<{
  items_total_fcfa: number;
  total_weight: number | null;
  total_volume: number | null;
  transport_cost: number | null;
  grand_total_fcfa: number;
  air_cost: number | null;
  sea_cost: number | null;
} | null> {
  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('id, transport_mode')
    .eq('id', orderId)
    .single();
  if (!order) return null;

  const { data: lines } = await supabaseAdmin
    .from('offer_order_lines')
    .select('unit_price_cny, quantity, weight, volume, has_battery')
    .eq('order_id', orderId);

  const pricing = computeOrderPricing(
    (lines || []).map((l) => ({
      unit_price_cny: Number(l.unit_price_cny) || 0,
      quantity: Number(l.quantity) || 1,
      weight: l.weight != null ? Number(l.weight) : null,
      volume: l.volume != null ? Number(l.volume) : null,
      has_battery: !!l.has_battery,
    })),
  );

  const mode = order.transport_mode as 'air' | 'sea' | 'quote' | null;
  const transportCost =
    mode === 'air' ? pricing.airCost : mode === 'sea' ? pricing.seaCost : null;
  const grandTotal = roundXafUp(
    pricing.itemsTotalFcfaRounded + (transportCost || 0),
  );

  await supabaseAdmin
    .from('offer_orders')
    .update({
      items_total_cny: pricing.itemsTotalCny,
      items_total_fcfa: pricing.itemsTotalFcfaRounded,
      total_weight: pricing.totalWeight,
      total_volume: pricing.totalVolume,
      has_battery: pricing.hasBattery,
      transport_cost: transportCost,
      grand_total_fcfa: grandTotal,
    })
    .eq('id', orderId);

  return {
    items_total_fcfa: pricing.itemsTotalFcfaRounded,
    total_weight: pricing.totalWeight,
    total_volume: pricing.totalVolume,
    transport_cost: transportCost,
    grand_total_fcfa: grandTotal,
    air_cost: pricing.airCost,
    sea_cost: pricing.seaCost,
  };
}
