import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent } from '@/lib/agent';
import { orderNumber } from '@/lib/order-number';
import { CNY_TO_FCFA } from '@/lib/offer-pricing';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select(
      'id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, payment_method, payment_status, order_status, transport_mode, offer_order_lines(id, product_title, variant_name, quantity, subtotal_cny)'
    )
    .eq('id', id)
    .single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const { data: actions } = await supabaseAdmin
    .from('agent_actions')
    .select('action, meta, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: false });

  type Line = { id: string; product_title?: string | null; variant_name?: string | null; quantity: number; subtotal_cny?: number };
  const lines = ((order.offer_order_lines || []) as Line[]).map((l) => ({
    id: l.id,
    product_title: l.product_title,
    variant_name: l.variant_name,
    quantity: l.quantity,
    subtotal_fcfa: (Number(l.subtotal_cny) || 0) * CNY_TO_FCFA,
  }));

  return NextResponse.json({
    order: {
      id: order.id,
      client_name: order.client_name,
      client_phone: order.client_phone,
      grand_total_fcfa: order.grand_total_fcfa,
      items_total_fcfa: order.items_total_fcfa,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.order_status,
      transport_mode: order.transport_mode,
      order_number: orderNumber(order.id),
    },
    lines,
    actions: actions || [],
  });
}
