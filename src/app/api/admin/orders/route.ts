import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

// GET: liste des commandes /offer (admin). ?pending=1 = uniquement à vérifier.
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  let query = supabaseAdmin
    .from('offer_orders')
    .select(
      'id, offer_id, client_name, client_phone, items_total_fcfa, grand_total_fcfa, transport_mode, status, payment_status, payment_method, payment_proof_url, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (request.nextUrl.searchParams.get('pending') === '1') {
    query = query.eq('payment_status', 'submitted');
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ orders: [], warning: error.message });
  return NextResponse.json({ orders: data || [] });
}
