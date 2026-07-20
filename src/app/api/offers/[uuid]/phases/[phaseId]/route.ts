import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';

// PATCH: renommer une phase. Body: { title }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; phaseId: string }> },
) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid, phaseId } = await params;
  const body = (await request.json().catch(() => ({}))) as { title?: string };
  if (typeof body.title !== 'string') {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('offer_phases')
    .update({ title: body.title.trim().slice(0, 120) })
    .eq('id', phaseId)
    .eq('offer_id', uuid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: supprimer une phase. Les catégories rattachées repassent « sans phase »
// (FK ON DELETE SET NULL) — les produits ne sont PAS supprimés.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; phaseId: string }> },
) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid, phaseId } = await params;
  const { error } = await supabaseAdmin
    .from('offer_phases')
    .delete()
    .eq('id', phaseId)
    .eq('offer_id', uuid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
