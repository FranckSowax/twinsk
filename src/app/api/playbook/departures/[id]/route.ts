import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';
import { getGroupInviteLink } from '@/lib/whapi';

const STATUSES = ['open', 'cutoff', 'loaded', 'transit', 'arrived', 'closed'] as const;

// PATCH: éditer un départ (dates, group_id, statut sans message). Admin ou "commandes".
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await resolveActor(request, ['commandes']))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    departure_date?: string | null;
    cutoff_date?: string | null;
    group_id?: string | null;
    status?: string;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.label === 'string' && body.label.trim()) patch.label = body.label.trim();
  if (body.departure_date !== undefined) patch.departure_date = body.departure_date || null;
  if (body.cutoff_date !== undefined) patch.cutoff_date = body.cutoff_date || null;
  if (body.status && (STATUSES as readonly string[]).includes(body.status)) patch.status = body.status;
  if (body.group_id !== undefined) {
    const gid = (body.group_id || '').trim() || null;
    patch.group_id = gid;
    patch.invite_link = gid ? await getGroupInviteLink(gid) : null;
  }

  const { data, error } = await supabaseAdmin
    .from('wa_departures')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ departure: data });
}

// DELETE: supprimer un départ (le groupe WhatsApp, lui, se supprime dans l'app WhatsApp).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await resolveActor(request, ['commandes']))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { id } = await params;
  const { error } = await supabaseAdmin.from('wa_departures').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
