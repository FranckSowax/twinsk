import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent } from '@/lib/agent';
import { orderNumber } from '@/lib/order-number';

export async function GET(request: NextRequest) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const filter = request.nextUrl.searchParams.get('filter') || 'all';
  let q = supabaseAdmin
    .from('offer_orders')
    .select('id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, payment_method, payment_status, order_status, transport_mode, created_at, status')
    .neq('status', 'cart') // on ignore les paniers abandonnés
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter === 'to_collect') q = q.neq('payment_status', 'paid');
  else if (filter === 'to_ship') q = q.eq('payment_status', 'paid').eq('order_status', 'paid');
  else if (filter === 'to_receive') q = q.eq('order_status', 'shipped');
  else if (filter === 'to_deliver') q = q.eq('order_status', 'at_agency');

  const { data } = await q;
  const orders = (data || []).map((o) => ({ ...o, order_number: orderNumber(o.id) }));
  return NextResponse.json({ orders });
}
