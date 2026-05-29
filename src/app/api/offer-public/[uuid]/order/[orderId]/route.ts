import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing, CNY_TO_FCFA } from '@/lib/offer-pricing';

// GET: Public order detail (for the confirmation / transport / checkout page).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> }
) {
  const { uuid, orderId } = await params;

  const { data: order, error } = await supabaseAdmin
    .from('offer_orders')
    .select('*, offer_order_lines(*)')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (error || !order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  // Recompute pricing dynamically based on the persisted lines so the customer
  // sees up-to-date totals even if the order is recalled later.
  type LineRow = {
    id: string;
    product_id: string;
    variant_id: string | null;
    variant_name: string | null;
    unit_price_cny: number;
    quantity: number;
    subtotal_cny: number;
  };
  const lines = (order.offer_order_lines || []) as LineRow[];

  // Load weights/volumes/battery from offer_products
  const productIds = Array.from(new Set(lines.map((l) => l.product_id)));
  type WL = { id: string; weight: number | null; volume: number | null; has_battery: boolean };
  const { data: prodRows } = await supabaseAdmin
    .from('offer_products')
    .select('id, weight, volume, has_battery')
    .in('id', productIds);
  const prodMap = new Map<string, WL>(
    ((prodRows || []) as WL[]).map((p) => [p.id, p])
  );

  const pricing = computeOrderPricing(
    lines.map((l) => {
      const meta = prodMap.get(l.product_id);
      return {
        unit_price_cny: l.unit_price_cny,
        quantity: l.quantity,
        weight: meta?.weight ?? null,
        volume: meta?.volume ?? null,
        has_battery: !!meta?.has_battery,
      };
    })
  );

  return NextResponse.json({
    order: {
      id: order.id,
      offer_id: order.offer_id,
      client_name: order.client_name,
      client_phone: order.client_phone,
      client_email: order.client_email,
      transport_mode: order.transport_mode,
      transport_cost: order.transport_cost,
      status: order.status,
      payment_status: order.payment_status,
      ebilling_reference: order.ebilling_reference,
      created_at: order.created_at,
      request_id: order.request_id,
    },
    lines: lines.map((l) => ({
      ...l,
      unit_price_fcfa: l.unit_price_cny * CNY_TO_FCFA,
      subtotal_fcfa: l.subtotal_cny * CNY_TO_FCFA,
    })),
    pricing,
  });
}
