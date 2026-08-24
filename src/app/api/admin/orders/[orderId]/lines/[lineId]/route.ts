import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';
import { recomputeOrder } from '@/lib/admin-order';

// PATCH: éditer une ligne de commande (admin ou collaborateur "commandes") —
// quantité, prix, poids, volume, batterie.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; lineId: string }> },
) {
  const actor = await resolveActor(request, ['commandes']);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId, lineId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    product_title?: string;
    unit_price_cny?: number;
    quantity?: number;
    weight?: number | null;
    volume?: number | null;
    has_battery?: boolean;
  };

  const patch: Record<string, unknown> = {};
  if (body.product_title !== undefined) patch.product_title = body.product_title.trim();
  if (body.unit_price_cny !== undefined) patch.unit_price_cny = Number(body.unit_price_cny) || 0;
  if (body.quantity !== undefined) patch.quantity = Math.max(1, Math.trunc(Number(body.quantity) || 1));
  if (body.weight !== undefined) patch.weight = body.weight;
  if (body.volume !== undefined) patch.volume = body.volume;
  if (body.has_battery !== undefined) patch.has_battery = body.has_battery;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
  }

  // Recalcule le sous-total si prix ou quantité change.
  if ('unit_price_cny' in patch || 'quantity' in patch) {
    const { data: cur } = await supabaseAdmin
      .from('offer_order_lines')
      .select('unit_price_cny, quantity')
      .eq('id', lineId)
      .single();
    const unit = (patch.unit_price_cny as number) ?? Number(cur?.unit_price_cny) ?? 0;
    const qty = (patch.quantity as number) ?? Number(cur?.quantity) ?? 1;
    patch.subtotal_cny = unit * qty;
  }

  const { error } = await supabaseAdmin
    .from('offer_order_lines')
    .update(patch)
    .eq('id', lineId)
    .eq('order_id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCollabAction(actor, {
    action: 'update_order_line',
    target_type: 'order',
    target_id: orderId,
    description: `Ligne modifiée : ${Object.keys(patch).join(', ')}`,
  });

  const totals = await recomputeOrder(orderId);
  return NextResponse.json({ success: true, totals });
}

// DELETE: retirer une ligne de commande (admin ou collaborateur "commandes").
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; lineId: string }> },
) {
  const actor = await resolveActor(request, ['commandes']);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId, lineId } = await params;
  const { error } = await supabaseAdmin
    .from('offer_order_lines')
    .delete()
    .eq('id', lineId)
    .eq('order_id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCollabAction(actor, {
    action: 'delete_order_line',
    target_type: 'order',
    target_id: orderId,
    description: 'Ligne supprimée',
  });

  const totals = await recomputeOrder(orderId);
  return NextResponse.json({ success: true, totals });
}
