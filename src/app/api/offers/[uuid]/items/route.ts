import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

// POST: Add items to an offer (admin OU collaborateur)
// Body: { items: [{ image_url, description }] }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;
  await logCollabAction(actor, { action: 'add_item', target_type: 'offer', target_id: uuid, description: 'Catégorie/article ajouté' });
  const { items } = await request.json();
  if (!Array.isArray(items) || !items.length) {
    return NextResponse.json({ error: 'Aucun article fourni' }, { status: 400 });
  }
  const invalid = items.find(
    (it: { image_url?: string | null; description?: string | null }) =>
      !it.image_url && !it.description
  );
  if (invalid) {
    return NextResponse.json(
      { error: 'Chaque article doit avoir une image ou une description' },
      { status: 400 }
    );
  }
  const rows = items.map(
    (it: { image_url?: string | null; description?: string | null }) => ({
      offer_id: uuid,
      image_url: it.image_url || null,
      description: it.description || null,
      processed: true,
      added_by: 'admin',
    })
  );
  const { data, error } = await supabaseAdmin
    .from('offer_items')
    .insert(rows)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
