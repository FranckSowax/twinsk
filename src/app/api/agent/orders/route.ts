import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent } from '@/lib/agent';
import { orderNumber } from '@/lib/order-number';

export async function GET(request: NextRequest) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const filter = request.nextUrl.searchParams.get('filter') || 'all';
  // Lignes embarquées : UNIQUEMENT product_image + quantity (vignette + nb d'articles).
  // Ne jamais réexposer ici les coûts CNY / product_url (fuite corrigée en revue finale).
  let q = supabaseAdmin
    .from('offer_orders')
    .select('id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, payment_method, payment_status, order_status, transport_mode, created_at, status, offer_order_lines(product_image, quantity)')
    .neq('status', 'cart') // on ignore les paniers abandonnés
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter === 'to_collect') q = q.neq('payment_status', 'paid');
  else if (filter === 'to_ship') q = q.eq('payment_status', 'paid').eq('order_status', 'paid');
  else if (filter === 'to_receive') q = q.eq('order_status', 'shipped');
  else if (filter === 'to_deliver') q = q.eq('order_status', 'at_agency');

  const { data } = await q;
  const orders = (data || []).map((o) => {
    const lines = (o.offer_order_lines || []) as { product_image: string | null; quantity: number | null }[];
    const row: Record<string, unknown> = { ...o };
    delete row.offer_order_lines;
    return {
      ...row,
      order_number: orderNumber(o.id),
      thumbnail: lines.find((l) => l.product_image)?.product_image ?? null,
      items_count: lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0) || lines.length,
    };
  });
  return NextResponse.json({ orders });
}
