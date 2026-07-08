import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/offer-pricing';

// PATCH: Customer picks a transport mode ('air' | 'sea' | 'quote') and we
// persist the corresponding transport_cost + grand_total.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> }
) {
  const { uuid, orderId } = await params;
  const body = await request.json().catch(() => ({}));
  const mode = body.transport_mode as 'air' | 'sea' | 'quote' | undefined;
  if (!mode || !['air', 'sea', 'quote'].includes(mode)) {
    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 });
  }

  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('id, offer_id, items_total_cny')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  type LineRow = {
    product_id: string;
    quantity: number;
    unit_price_cny: number;
  };
  const { data: lines } = await supabaseAdmin
    .from('offer_order_lines')
    .select('product_id, quantity, unit_price_cny')
    .eq('order_id', orderId);

  type WL = { id: string; weight: number | null; volume: number | null; has_battery: boolean };
  const ids = Array.from(new Set((lines || []).map((l: LineRow) => l.product_id)));
  const { data: prods } = await supabaseAdmin
    .from('offer_products')
    .select('id, weight, volume, has_battery')
    .in('id', ids.length ? ids : ['']);
  const pm = new Map<string, WL>(((prods || []) as WL[]).map((p) => [p.id, p]));

  const pricing = computeOrderPricing(
    (lines || []).map((l: LineRow) => ({
      unit_price_cny: l.unit_price_cny,
      quantity: l.quantity,
      weight: pm.get(l.product_id)?.weight ?? null,
      volume: pm.get(l.product_id)?.volume ?? null,
      has_battery: !!pm.get(l.product_id)?.has_battery,
    }))
  );

  let transportCost: number | null = null;
  let grandTotal: number | null = pricing.itemsTotalFcfaRounded;
  if (mode === 'air') {
    if (!pricing.airAvailable) {
      return NextResponse.json(
        { error: 'Fret aérien indisponible (poids manquant)' },
        { status: 400 }
      );
    }
    transportCost = pricing.airCost;
    grandTotal = pricing.airTotal;
  } else if (mode === 'sea') {
    if (!pricing.seaAvailable) {
      return NextResponse.json(
        { error: 'Fret maritime indisponible (volume manquant)' },
        { status: 400 }
      );
    }
    transportCost = pricing.seaCost;
    grandTotal = pricing.seaTotal;
  } else {
    // 'quote' = customer asks for a custom quote (no auto pricing)
    transportCost = null;
    grandTotal = null;
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
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, order: updated, pricing });
}
