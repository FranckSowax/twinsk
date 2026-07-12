import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin, resolveActor, logCollabAction } from '@/lib/collab';

const FILL_FIELDS = [
  'price',
  'weight',
  'volume',
  'dimensions',
  'supplier_shipping_price',
  'delivery_time',
  'has_battery',
  'moq',
  'collab_notes',
  'admin_note',
] as const;

// PATCH: compléter les infos et/ou marquer révisée (admin + collaborateur).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const f of FILL_FIELDS) {
    if (f in body) patch[f] = body[f];
  }

  if ('review_status' in body) {
    const rs = body.review_status;
    if (rs !== 'pending' && rs !== 'reviewed') {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }
    patch.review_status = rs;
    if (rs === 'reviewed') {
      patch.reviewed_at = new Date().toISOString();
      patch.reviewed_by = actor.role === 'collab' ? actor.collaborator.id : null;
    } else {
      patch.reviewed_at = null;
      patch.reviewed_by = null;
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('collab_review_lines').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCollabAction(actor, {
    action: patch.review_status === 'reviewed' ? 'review_line_done' : 'review_line_edit',
    target_type: 'collab_review_line',
    target_id: id,
    description:
      patch.review_status === 'reviewed'
        ? 'Ligne marquée révisée'
        : `Infos complétées (${Object.keys(patch).join(', ')})`,
  });

  return NextResponse.json({ success: true });
}

// DELETE: retirer une ligne de la file (admin only).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { error } = await supabaseAdmin.from('collab_review_lines').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
