import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin, hashPassword } from '@/lib/collab';

// PATCH: activer/désactiver, renommer ou changer le mot de passe (admin only).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    active?: boolean;
    name?: string;
    password?: string;
  };
  const patch: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.password === 'string' && body.password.length >= 4) {
    patch.password_hash = hashPassword(body.password);
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('collaborators').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: supprimer un collaborateur (admin only).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { error } = await supabaseAdmin.from('collaborators').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
