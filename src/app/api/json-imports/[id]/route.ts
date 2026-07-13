import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, isAdmin } from '@/lib/collab';

// GET: récupère le payload complet d'un JSON importé (pour copie/téléchargement).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('json_imports')
    .select('id, label, product_count, payload')
    .eq('id', id)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE: supprimer un JSON importé (admin only).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { error } = await supabaseAdmin.from('json_imports').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
