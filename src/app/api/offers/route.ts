import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

// DELETE: suppression en lot d'offres (admin only). Body: { ids: string[] }.
// Le cascade DB retire catégories / produits / commandes liées.
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((v) => typeof v === 'string') : [];
  if (!ids.length) {
    return NextResponse.json({ error: 'Aucune offre à supprimer' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('offers').delete().in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted: ids.length });
}

// GET: List all offers (admin OU collaborateur)
export async function GET(request: NextRequest) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('offers')
    .select('*, offer_items(count), offer_orders(count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: Create a new offer (admin only)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { title, theme, description, offer_type } = body as {
    title?: string;
    theme?: string;
    description?: string;
    offer_type?: string;
  };

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
  }
  if (offer_type !== undefined && offer_type !== 'b2c' && offer_type !== 'b2b') {
    return NextResponse.json({ error: 'Type d’offre invalide' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('offers')
    .insert({
      title: title.trim(),
      theme: theme?.trim() || null,
      description: description?.trim() || null,
      status: 'draft',
      // b2c = défaut colonne ; on ne force la valeur que pour le B2B afin de
      // rester compatible tant que la migration 36 n'est pas appliquée.
      ...(offer_type === 'b2b' ? { offer_type: 'b2b' } : {}),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
