import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

// PATCH: Update a single request_item (admin only).
// Body: { image_url?: string|null, description?: string|null }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; itemId: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { uuid, itemId } = await params;
    const body = (await request.json()) as {
      image_url?: string | null;
      description?: string | null;
    };

    const patch: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'image_url')) {
      patch.image_url = body.image_url ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      patch.description = body.description ?? null;
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
    }

    // Reject empty payloads (item must have either image or description)
    if (
      Object.prototype.hasOwnProperty.call(patch, 'image_url') &&
      Object.prototype.hasOwnProperty.call(patch, 'description') &&
      !patch.image_url &&
      !patch.description
    ) {
      return NextResponse.json(
        { error: 'Un article doit avoir au moins une image ou une description' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('request_items')
      .update(patch)
      .eq('id', itemId)
      .eq('request_id', uuid)
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

// DELETE: Remove a single request_item and its dependent search_results (admin only).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; itemId: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { uuid, itemId } = await params;

    // Defensive: drop dependent search_results first (in case FK has no cascade).
    const { error: srErr } = await supabaseAdmin
      .from('search_results')
      .delete()
      .eq('request_item_id', itemId);
    if (srErr) {
      return NextResponse.json({ error: srErr.message }, { status: 500 });
    }

    const { error } = await supabaseAdmin
      .from('request_items')
      .delete()
      .eq('id', itemId)
      .eq('request_id', uuid);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
