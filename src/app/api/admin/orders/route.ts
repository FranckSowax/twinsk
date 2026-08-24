import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';

// GET: liste des commandes /offer (admin ou collaborateur rôle "commandes").
// ?pending=1 = uniquement à vérifier.
export async function GET(request: NextRequest) {
  if (!(await resolveActor(request, ['commandes']))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  let query = supabaseAdmin
    .from('offer_orders')
    .select(
      'id, offer_id, client_name, client_phone, items_total_fcfa, grand_total_fcfa, transport_mode, status, order_status, payment_status, payment_method, payment_proof_url, created_at, offer_order_lines(product_image, quantity)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (request.nextUrl.searchParams.get('pending') === '1') {
    query = query.eq('payment_status', 'submitted');
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ orders: [], warning: error.message });
  // Vignette + nb d'articles dérivés des lignes (non renvoyées telles quelles).
  const orders = (data || []).map((o) => {
    const lines = (o.offer_order_lines || []) as { product_image: string | null; quantity: number | null }[];
    const row: Record<string, unknown> = { ...o };
    delete row.offer_order_lines;
    return {
      ...row,
      thumbnail: lines.find((l) => l.product_image)?.product_image ?? null,
      items_count: lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0) || lines.length,
    };
  });
  return NextResponse.json({ orders });
}
