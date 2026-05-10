import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const STATUSES = ['new', 'in_progress', 'done', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
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
    const body = (await request.json()) as { status?: string; admin_note?: string | null };

    const update: { status?: Status; admin_note?: string | null } = {};
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as Status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
      }
      update.status = body.status as Status;
    }
    if (body.admin_note !== undefined) {
      update.admin_note = body.admin_note;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[Leads] Patch error:', err);
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
    const { error } = await supabaseAdmin.from('leads').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Leads] Delete error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
