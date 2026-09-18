import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing, roundSettlement, transportCostFor } from '@/lib/offer-pricing';
import { loadOrderPricingLines, offerSettlementCurrency } from '@/lib/order-pricing-lines';

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
    .select('id, offer_id, transport_mode')
    .eq('id', orderId)
    .single();
  if (!order) return null;
  const currency = await offerSettlementCurrency(order.offer_id);

  // Lignes (snapshot poids/volume/batterie, repli variante/produit) + répartition
  // avion/bateau éventuelle (transport fractionné).
  const pricing = computeOrderPricing(await loadOrderPricingLines(orderId), { currency });

  const mode = order.transport_mode as 'air' | 'sea' | 'mixed' | 'quote' | null;
  const transportCost = transportCostFor(pricing, mode);
  const grandTotal = roundSettlement(
    pricing.itemsTotalFcfaRounded + (transportCost || 0),
    currency,
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
