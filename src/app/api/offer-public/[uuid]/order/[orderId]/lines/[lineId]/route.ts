import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { loadEditableOrder, recomputeAfterLineChange } from '@/lib/offer-order-lines-edit';

type Ctx = { params: Promise<{ uuid: string; orderId: string; lineId: string }> };

async function lineOf(orderId: string, lineId: string) {
  const { data } = await supabaseAdmin.from('offer_order_lines').select('id, unit_price_cny').eq('id', lineId).eq('order_id', orderId).maybeSingle();
  return data as { id: string; unit_price_cny: number } | null;
}

// PATCH : change la quantité d'une ligne. Body: { quantity }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { uuid, orderId, lineId } = await params;
  const order = await loadEditableOrder(uuid, orderId);
  if ('error' in order) return NextResponse.json({ error: order.error }, { status: order.status });
  const line = await lineOf(orderId, lineId);
  if (!line) return NextResponse.json({ error: 'Ligne introuvable' }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { quantity?: number };
  const qty = Math.trunc(Number(body.quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 999) return NextResponse.json({ error: 'Quantité invalide (1 à 999)' }, { status: 400 });
  await supabaseAdmin.from('offer_order_lines').update({ quantity: qty, subtotal_cny: Number(line.unit_price_cny) * qty }).eq('id', lineId);
  const r = await recomputeAfterLineChange(order);
  return NextResponse.json({ success: true, ...r });
}

// DELETE : retire une ligne (jamais la dernière : une commande a toujours un produit).
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { uuid, orderId, lineId } = await params;
  const order = await loadEditableOrder(uuid, orderId);
  if ('error' in order) return NextResponse.json({ error: order.error }, { status: order.status });
  const line = await lineOf(orderId, lineId);
  if (!line) return NextResponse.json({ error: 'Ligne introuvable' }, { status: 404 });
  const { count } = await supabaseAdmin.from('offer_order_lines').select('id', { count: 'exact', head: true }).eq('order_id', orderId);
  if ((count || 0) <= 1) return NextResponse.json({ error: 'Une commande doit garder au moins un produit.' }, { status: 409 });
  await supabaseAdmin.from('offer_order_lines').delete().eq('id', lineId);
  const r = await recomputeAfterLineChange(order);
  return NextResponse.json({ success: true, ...r });
}
