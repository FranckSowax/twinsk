import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { insertOrderLines, priceOrderPicks } from '@/lib/offer-order-create';
import { loadEditableOrder, orderAffiliateCommission, recomputeAfterLineChange } from '@/lib/offer-order-lines-edit';

// POST : ajoute un produit au panier d'une commande non payée.
// Body: { product_id, variant_id?, quantity? } — même produit + même variante
// déjà présents → la quantité s'additionne.
export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string; orderId: string }> }) {
  const { uuid, orderId } = await params;
  const order = await loadEditableOrder(uuid, orderId);
  if ('error' in order) return NextResponse.json({ error: order.error }, { status: order.status });
  const body = (await request.json().catch(() => ({}))) as { product_id?: string; variant_id?: string | null; quantity?: number };
  if (!body.product_id) return NextResponse.json({ error: 'Produit requis' }, { status: 400 });
  const qty = Math.max(1, Math.trunc(Number(body.quantity) || 1));

  // Le produit doit appartenir au listing de la commande.
  const { data: prod } = await supabaseAdmin
    .from('offer_products')
    .select('id, offer_items!inner(offer_id)')
    .eq('id', body.product_id)
    .single();
  const belongs = (prod as { offer_items?: { offer_id?: string } | { offer_id?: string }[] } | null)?.offer_items;
  const offerOfProduct = Array.isArray(belongs) ? belongs[0]?.offer_id : belongs?.offer_id;
  if (!prod || offerOfProduct !== uuid) return NextResponse.json({ error: 'Produit hors du listing' }, { status: 400 });

  // Ligne identique déjà présente → quantité cumulée.
  let q = supabaseAdmin.from('offer_order_lines').select('id, quantity, unit_price_cny').eq('order_id', orderId).eq('product_id', body.product_id);
  q = body.variant_id ? q.eq('variant_id', body.variant_id) : q.is('variant_id', null);
  const { data: existing } = await q.maybeSingle();
  if (existing) {
    const newQty = Number(existing.quantity) + qty;
    await supabaseAdmin
      .from('offer_order_lines')
      .update({ quantity: newQty, subtotal_cny: Number(existing.unit_price_cny) * newQty })
      .eq('id', existing.id);
  } else {
    const priced = await priceOrderPicks([{ product_id: body.product_id, variant_id: body.variant_id || null, quantity: qty }], await orderAffiliateCommission(order));
    if ('error' in priced) return NextResponse.json({ error: priced.error }, { status: priced.status });
    const err = await insertOrderLines(orderId, priced.lineRows);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
  }
  const r = await recomputeAfterLineChange(order);
  return NextResponse.json({ success: true, ...r });
}
