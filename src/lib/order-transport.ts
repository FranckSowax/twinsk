// Choix du transport d'une commande /offer (aérien, maritime, fractionné avion
// + bateau, ou sur devis) : enregistre la répartition par ligne (mode
// fractionné), recalcule les totaux et les persiste. Partagé par la page
// commande (client) et le panier client de l'admin.

import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing, type PricingResult, type TransportMode } from '@/lib/offer-pricing';
import { loadOrderPricingLines, offerSettlementCurrency } from '@/lib/order-pricing-lines';
import { clearOrderSplit, writeOrderSplit } from '@/lib/order-split';
import { pricingOptionsFor } from '@/lib/promo';

export const TRANSPORT_MODES: TransportMode[] = ['air', 'sea', 'mixed', 'quote'];

export function parseTransportMode(v: unknown): TransportMode | null {
  return typeof v === 'string' && (TRANSPORT_MODES as string[]).includes(v) ? (v as TransportMode) : null;
}

export type ApplyTransportResult =
  | { ok: true; order: Record<string, unknown>; pricing: PricingResult }
  | { ok: false; status: number; error: string };

/**
 * Applique un mode de transport à une commande. `split` = { lineId: unités
 * avion } (requis en mode fractionné ; le reste de chaque ligne part en bateau).
 */
export async function applyOrderTransport(args: {
  orderId: string;
  offerId: string;
  mode: TransportMode;
  split?: Record<string, unknown> | null;
}): Promise<ApplyTransportResult> {
  const { orderId, offerId, mode } = args;
  const { data: order } = await supabaseAdmin.from('offer_orders').select('*').eq('id', orderId).eq('offer_id', offerId).single();
  if (!order) return { ok: false, status: 404, error: 'Commande introuvable' };

  if (mode === 'mixed') {
    const raw = args.split && typeof args.split === 'object' ? args.split : null;
    if (!raw) return { ok: false, status: 400, error: 'Répartition avion / bateau manquante' };
    const { data: lineRows } = await supabaseAdmin.from('offer_order_lines').select('id, quantity').eq('order_id', orderId);
    const split: Record<string, number> = {};
    for (const l of (lineRows || []) as { id: string; quantity: number }[]) {
      const n = Math.trunc(Number(raw[l.id]));
      split[l.id] = Number.isFinite(n) ? Math.min(Math.max(0, n), Number(l.quantity) || 0) : 0;
    }
    await writeOrderSplit(orderId, split);
  } else {
    await clearOrderSplit(orderId);
  }

  const pricing = computeOrderPricing(await loadOrderPricingLines(orderId), {
    ...pricingOptionsFor(order),
    currency: await offerSettlementCurrency(offerId),
  });

  let transportCost: number | null = null;
  let grandTotal: number | null = pricing.itemsNetFcfa;
  if (mode === 'air') {
    if (!pricing.airAvailable) return { ok: false, status: 400, error: 'Fret aérien indisponible (poids manquant)' };
    transportCost = pricing.airCost;
    grandTotal = pricing.airTotal;
  } else if (mode === 'sea') {
    if (pricing.seaOverLimit) return { ok: false, status: 400, error: 'Au-delà de 20 m³, le maritime part en conteneur dédié sur devis : contactez Oh My Gab sur WhatsApp.' };
    if (!pricing.seaAvailable) return { ok: false, status: 400, error: 'Fret maritime indisponible (volume manquant)' };
    transportCost = pricing.seaCost;
    grandTotal = pricing.seaTotal;
  } else if (mode === 'mixed') {
    if (pricing.mixed?.seaOverLimit) {
      return { ok: false, status: 400, error: 'La part bateau dépasse 20 m³ : conteneur dédié sur devis, contactez Oh My Gab sur WhatsApp.' };
    }
    if (!pricing.mixed || !pricing.mixed.available || pricing.mixed.cost == null) {
      return { ok: false, status: 400, error: 'Transport fractionné indisponible : poids manquant côté avion ou volume manquant côté bateau' };
    }
    transportCost = pricing.mixed.cost;
    grandTotal = pricing.mixed.total;
  } else {
    // 'quote' : devis sur mesure, transport fixé plus tard par l'admin ; le
    // total produits reste (colonne NOT NULL), sans transport.
    transportCost = null;
    grandTotal = pricing.itemsNetFcfa;
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('offer_orders')
    .update({
      transport_mode: mode,
      transport_cost: transportCost,
      items_total_fcfa: pricing.itemsTotalFcfaRounded,
      total_weight: pricing.totalWeight,
      total_volume: pricing.totalVolume,
      grand_total_fcfa: grandTotal,
      status: 'transport_selected',
    })
    .eq('id', orderId)
    .select()
    .single();
  if (updErr || !updated) return { ok: false, status: 500, error: updErr?.message || 'Enregistrement impossible' };
  return { ok: true, order: { ...updated, previous_transport_mode: order.transport_mode }, pricing };
}
