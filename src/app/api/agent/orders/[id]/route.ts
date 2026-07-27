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
    .select('*, offer_order_lines(*)')
    .eq('id', id)
    .single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const { data: actions } = await supabaseAdmin
    .from('agent_actions')
    .select('action, meta, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: false });

  type Line = { unit_price_cny?: number; subtotal_cny?: number; [k: string]: unknown };
  const lines = ((order.offer_order_lines || []) as Line[]).map((l) => ({
    ...l,
    subtotal_fcfa: (Number(l.subtotal_cny) || 0) * CNY_TO_FCFA,
  }));

  return NextResponse.json({
    order: { ...order, order_number: orderNumber(order.id), offer_order_lines: undefined },
    lines,
    actions: actions || [],
  });
}
