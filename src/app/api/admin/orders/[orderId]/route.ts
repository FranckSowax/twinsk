import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';
import { CNY_TO_FCFA } from '@/lib/offer-pricing';
import { roundXafUp } from '@/lib/utils/formatCurrency';
import { recomputeOrder } from '@/lib/admin-order';
import { sendWhapiText } from '@/lib/whapi';

// GET: détail complet d'une commande (admin ou collaborateur "commandes") — pour le modal.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!(await resolveActor(request, ['commandes']))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { orderId } = await params;

  const { data: order, error } = await supabaseAdmin
    .from('offer_orders')
    .select('*, offers(title)')
    .eq('id', orderId)
    .single();
  if (error || !order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  // `*` pour rester résilient si les colonnes snapshot weight/volume/has_battery
  // (migration 30) manquent encore en prod (sinon le SELECT échoue).
  const { data: lineRows } = await supabaseAdmin
    .from('offer_order_lines')
    .select('*')
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

// PATCH: éditer une commande (admin ou collaborateur "commandes") — paiement,
// statut, infos client, transport.
// Body: { payment_status?, order_status?, client_name?, client_phone?,
//         client_email?, transport_mode? ('air'|'sea'|'quote') }
const ORDER_STATUSES = ['unpaid', 'paid', 'shipped', 'at_agency', 'delivered'] as const;
const TRANSPORT_MODES = ['air', 'sea', 'quote'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const actor = await resolveActor(request, ['commandes']);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    payment_status?: string;
    order_status?: string;
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    transport_mode?: string;
  };

  const patch: Record<string, unknown> = {};
  let needRecompute = false;

  if (body.payment_status !== undefined) {
    if (body.payment_status !== 'paid' && body.payment_status !== 'pending') {
      return NextResponse.json({ error: 'Statut paiement invalide' }, { status: 400 });
    }
    patch.payment_status = body.payment_status;
    if (body.payment_status === 'paid') {
      patch.status = 'paid';
      patch.order_status = 'paid';
    }
  }

  if (body.order_status !== undefined) {
    if (!ORDER_STATUSES.includes(body.order_status as (typeof ORDER_STATUSES)[number])) {
      return NextResponse.json({ error: 'Statut commande invalide' }, { status: 400 });
    }
    patch.order_status = body.order_status;
  }

  if (body.client_name !== undefined) patch.client_name = body.client_name.trim();
  if (body.client_phone !== undefined) patch.client_phone = body.client_phone.trim();
  if (body.client_email !== undefined) patch.client_email = body.client_email.trim() || null;

  if (body.transport_mode !== undefined) {
    if (!TRANSPORT_MODES.includes(body.transport_mode as (typeof TRANSPORT_MODES)[number])) {
      return NextResponse.json({ error: 'Mode transport invalide' }, { status: 400 });
    }
    patch.transport_mode = body.transport_mode;
    if (patch.status === undefined) patch.status = 'transport_selected';
    needRecompute = true; // le coût transport dépend du mode
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('offer_orders').update(patch).eq('id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCollabAction(actor, {
    action: 'update_order',
    target_type: 'order',
    target_id: orderId,
    description: `Champs modifiés : ${Object.keys(patch).join(', ')}`,
  });

  // Notification à l'affilié quand son paiement est validé (marque blanche).
  if (patch.payment_status === 'paid') {
    try {
      const { data: o } = await supabaseAdmin
        .from('offer_orders')
        .select('client_name, grand_total_fcfa, items_total_fcfa, commission_fcfa, affiliate_id')
        .eq('id', orderId)
        .single();
      if (o?.affiliate_id) {
        const { data: aff } = await supabaseAdmin
          .from('affiliates')
          .select('shop_name, whatsapp_number')
          .eq('id', o.affiliate_id)
          .single();
        if (aff?.whatsapp_number) {
          const total = Number(o.grand_total_fcfa ?? o.items_total_fcfa) || 0;
          const commission = Number(o.commission_fcfa) || 0;
          await sendWhapiText(
            `💰 Paiement validé — Boutique « ${aff.shop_name || 'Partenaire'} »\n` +
              `Client : ${o.client_name || '—'}\n` +
              `Total : ${Math.round(total).toLocaleString('fr-FR')} FCFA\n` +
              (commission > 0 ? `Votre commission : ${Math.round(commission).toLocaleString('fr-FR')} FCFA` : ''),
            `${aff.whatsapp_number.replace(/\D/g, '')}@s.whatsapp.net`,
          );
        }
      }
    } catch {
      // best-effort
    }
  }

  const totals = needRecompute ? await recomputeOrder(orderId) : null;
  return NextResponse.json({ success: true, totals });
}
