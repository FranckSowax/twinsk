import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { CNY_TO_FCFA } from '@/lib/offer-pricing';
import { roundXafUp } from '@/lib/utils/formatCurrency';

// GET: détail complet d'une commande (admin) — pour le modal.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId } = await params;

  const { data: order, error } = await supabaseAdmin
    .from('offer_orders')
    .select('*, offers(title)')
    .eq('id', orderId)
    .single();
  if (error || !order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  const { data: lineRows } = await supabaseAdmin
    .from('offer_order_lines')
    .select('id, product_id, product_title, product_image, variant_name, quantity, unit_price_cny, subtotal_cny')
    .eq('order_id', orderId);

  const lines = (lineRows || []).map((l) => ({
    ...l,
    unit_price_fcfa: roundXafUp((l.unit_price_cny || 0) * CNY_TO_FCFA),
    subtotal_fcfa: roundXafUp((l.subtotal_cny || 0) * CNY_TO_FCFA),
  }));

  return NextResponse.json({
    order: { ...order, offer_title: (order.offers as { title?: string } | null)?.title || null },
    lines,
  });
}

// PATCH: valider ou rejeter le paiement d'une commande (admin).
// Body: { payment_status: 'paid' | 'pending' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as { payment_status?: string };
  const status = body.payment_status;
  if (status !== 'paid' && status !== 'pending') {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }
  const patch: Record<string, unknown> = { payment_status: status };
  if (status === 'paid') patch.status = 'paid';
  const { error } = await supabaseAdmin.from('offer_orders').update(patch).eq('id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
