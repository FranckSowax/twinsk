import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

// PATCH: Update an offer_item (image / description)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; itemId: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid, itemId } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if ('image_url' in body) patch.image_url = body.image_url ?? null;
  if ('description' in body) patch.description = body.description ?? null;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
  }
  if (
    'image_url' in patch &&
    'description' in patch &&
    !patch.image_url &&
    !patch.description
  ) {
    return NextResponse.json(
      { error: 'Un article doit avoir au moins une image ou une description' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('offer_items')
    .update(patch)
    .eq('id', itemId)
    .eq('offer_id', uuid)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: Remove offer_item + dependent offer_products
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; itemId: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid, itemId } = await params;
  const { error } = await supabaseAdmin
    .from('offer_items')
    .delete()
    .eq('id', itemId)
    .eq('offer_id', uuid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
