import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

// GET: un dossier et ses usines, dans l'ordre du classement importé.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { id } = await params;
  const { data: dossier, error } = await supabaseAdmin
    .from('factory_dossiers')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !dossier) {
    return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });
  }
  const { data: usines, error: erreurUsines } = await supabaseAdmin
    .from('factories')
    .select('*')
    .eq('dossier_id', id)
    // rang nul (usine non classée) en fin de liste plutôt qu'en tête.
    .order('rang', { ascending: true, nullsFirst: false });
  if (erreurUsines) {
    return NextResponse.json({ error: erreurUsines.message }, { status: 500 });
  }
  return NextResponse.json({ dossier, usines: usines || [] });
}

// DELETE: supprime le dossier et ses usines (cascade). Admin uniquement.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { id } = await params;
  const { error } = await supabaseAdmin.from('factory_dossiers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
