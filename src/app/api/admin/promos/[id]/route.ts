import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { normalizePhone } from '@/lib/promo';

// PATCH  → modifie : active, label, ends_at, max_uses, max_uses_per_phone, notes,
//          client_phone, min_items_fcfa (le code, le type et la valeur ne changent
//          pas : on crée un nouveau code plutôt que de réécrire l'histoire)
// DELETE → supprime si jamais utilisé, sinon désactive
// GET    → usages du code (commandes, numéros, statut)

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { data: uses } = await supabaseAdmin
    .from('promo_uses')
    .select('order_id, client_phone, discount_fcfa, status, created_at, confirmed_at')
    .eq('promo_id', id)
    .order('created_at', { ascending: false })
    .limit(200);
  const orderIds = (uses || []).map((u) => u.order_id);
  const { data: orders } = orderIds.length
    ? await supabaseAdmin
        .from('offer_orders')
        .select('id, client_name, grand_total_fcfa, payment_status, transport_mode')
        .in('id', orderIds)
    : { data: [] as { id: string; client_name: string | null; grand_total_fcfa: number | null; payment_status: string | null; transport_mode: string | null }[] };
  const om = new Map((orders || []).map((o) => [o.id, o]));
  return NextResponse.json({
    uses: (uses || []).map((u) => ({ ...u, order: om.get(u.order_id) || null })),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.active === 'boolean') patch.active = b.active;
  if (typeof b.label === 'string') patch.label = b.label.trim() || null;
  if (typeof b.notes === 'string') patch.notes = b.notes.trim() || null;
  if (b.ends_at === null || typeof b.ends_at === 'string') patch.ends_at = b.ends_at || null;
  if (b.starts_at === null || typeof b.starts_at === 'string') patch.starts_at = b.starts_at || null;
  if (b.max_uses === null || typeof b.max_uses === 'number') patch.max_uses = b.max_uses && Number(b.max_uses) > 0 ? Math.round(Number(b.max_uses)) : null;
  if (typeof b.max_uses_per_phone === 'number') patch.max_uses_per_phone = Math.max(1, Math.round(b.max_uses_per_phone));
  if (b.client_phone === null || typeof b.client_phone === 'string') patch.client_phone = b.client_phone ? normalizePhone(b.client_phone) || null : null;
  if (b.min_items_fcfa === null || typeof b.min_items_fcfa === 'number') patch.min_items_fcfa = b.min_items_fcfa && Number(b.min_items_fcfa) > 0 ? Number(b.min_items_fcfa) : null;

  const { data, error } = await supabaseAdmin.from('promo_codes').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, promo: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { count } = await supabaseAdmin
    .from('promo_uses')
    .select('id', { count: 'exact', head: true })
    .eq('promo_id', id)
    .neq('status', 'released');
  if ((count || 0) > 0) {
    // Un code déjà utilisé garde son historique : on le désactive.
    await supabaseAdmin.from('promo_codes').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ success: true, deactivated: true });
  }
  const { error } = await supabaseAdmin.from('promo_codes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted: true });
}
