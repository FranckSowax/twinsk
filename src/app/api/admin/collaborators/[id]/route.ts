import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const ROLES = ['admin', 'agent', 'viewer'] as const;
const STATUSES = ['invited', 'active', 'disabled'] as const;
type Role = (typeof ROLES)[number];
type Status = (typeof STATUSES)[number];

function isAdmin(req: NextRequest): boolean {
  const c = req.cookies.get('admin_token');
  return !!c && c.value === process.env.ADMIN_PASSWORD;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = (await request.json()) as { role?: string; status?: string; name?: string };

    const update: Record<string, string> = {};
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role as Role)) {
        return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
      }
      update.role = body.role;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as Status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
      }
      update.status = body.status;
    }
    if (body.name !== undefined) update.name = body.name.trim();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_collaborators')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('admin_collaborators')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
