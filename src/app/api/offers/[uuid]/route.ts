import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';
import { normalizeBestSellers } from '@/lib/best-sellers';

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

// GET: Offer details (admin OU collaborateur)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;
  const { data, error } = await supabaseAdmin
    .from('offers')
    .select('*')
    .eq('id', uuid)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });
  }
  return NextResponse.json(data);
}

// PATCH: Update offer fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  const allowed = ['title', 'theme', 'description', 'status', 'slug', 'cover_image_url', 'cover_video_url', 'mobile_video_url', 'offer_currency'] as const;
  for (const key of allowed) {
    if (key in body) patch[key] = body[key as keyof typeof body];
  }
  // Galerie « Best sellers » (migration 57) : normalisée côté serveur (12 max, dédoublonnée).
  if ('best_sellers' in body) patch.best_sellers = normalizeBestSellers(body.best_sellers);
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('offers')
    .update(patch)
    .eq('id', uuid)
    .select()
    .single();
  if (error) {
    const msg = /best_sellers/.test(error.message)
      ? 'Colonne best_sellers absente : appliquer la migration 57 (supabase-migration-57.sql).'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE: Remove offer + cascaded items/products/orders
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;
  const { error } = await supabaseAdmin.from('offers').delete().eq('id', uuid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
