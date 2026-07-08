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
    .select('id, product_id, product_title, product_image, product_url, variant_name, quantity, unit_price_cny, subtotal_cny')
    .eq('order_id', orderId);

  // Fallback : produits non encore snapshotés (anciennes commandes) → on récupère
  // l'URL 1688 depuis offer_products si le produit existe toujours.
  const lineList = (lineRows || []) as Record<string, unknown>[];
  const missingUrlIds = lineList
    .filter((l) => !l.product_url && l.product_id)
    .map((l) => l.product_id as string);
  const urlMap = new Map<string, string | null>();
  if (missingUrlIds.length) {
    const { data: prods } = await supabaseAdmin
      .from('offer_products')
      .select('id, product_url')
      .in('id', missingUrlIds);
    for (const p of (prods || []) as { id: string; product_url: string | null }[]) {
      urlMap.set(p.id, p.product_url);
    }
  }

  const lines = lineList.map((l) => ({
    ...l,
    product_url: (l.product_url as string | null) || (l.product_id ? urlMap.get(l.product_id as string) || null : null),
    unit_price_fcfa: roundXafUp(((l.unit_price_cny as number) || 0) * CNY_TO_FCFA),
    subtotal_fcfa: roundXafUp(((l.subtotal_cny as number) || 0) * CNY_TO_FCFA),
  }));

  return NextResponse.json({
    order: { ...order, offer_title: (order.offers as { title?: string } | null)?.title || null },
    lines,
  });
}

// PATCH: valider le paiement OU changer le statut de traitement (admin).
// Body: { payment_status?: 'paid' | 'pending', order_status?: 'unpaid'|'paid'|'shipped'|'delivered' }
const ORDER_STATUSES = ['unpaid', 'paid', 'shipped', 'delivered'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    payment_status?: string;
    order_status?: string;
  };

  const patch: Record<string, unknown> = {};

  if (body.payment_status !== undefined) {
    if (body.payment_status !== 'paid' && body.payment_status !== 'pending') {
      return NextResponse.json({ error: 'Statut paiement invalide' }, { status: 400 });
    }
    patch.payment_status = body.payment_status;
    if (body.payment_status === 'paid') {
      patch.status = 'paid';
      // Valider le paiement fait passer le statut de traitement à « payée ».
      patch.order_status = 'paid';
    }
  }

  if (body.order_status !== undefined) {
    if (!ORDER_STATUSES.includes(body.order_status as (typeof ORDER_STATUSES)[number])) {
      return NextResponse.json({ error: 'Statut commande invalide' }, { status: 400 });
    }
    patch.order_status = body.order_status;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('offer_orders').update(patch).eq('id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
