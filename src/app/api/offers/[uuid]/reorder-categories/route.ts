import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

// POST: réordonne les catégories (offer_items) d'une offre selon l'ordre fourni.
// Body: { orderedItemIds: string[] } — nouvel ordre. position = index.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;

  const body = (await request.json().catch(() => ({}))) as { orderedItemIds?: string[] };
  const ids = Array.isArray(body.orderedItemIds) ? body.orderedItemIds.filter(Boolean) : [];
  if (!ids.length) {
    return NextResponse.json({ error: 'orderedItemIds requis' }, { status: 400 });
  }

  // Sécurité : ne réordonne que les catégories appartenant à cette offre.
  const { data: existing } = await supabaseAdmin
    .from('offer_items')
    .select('id')
    .eq('offer_id', uuid);
  const valid = new Set((existing || []).map((r) => r.id));

  const updates = ids
    .filter((id) => valid.has(id))
    .map((id, index) =>
      supabaseAdmin.from('offer_items').update({ position: index }).eq('id', id).eq('offer_id', uuid),
    );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  await logCollabAction(actor, {
    action: 'reorder_categories',
    target_type: 'offer',
    target_id: uuid,
    description: 'Catégories réordonnées',
  });

  return NextResponse.json({ success: true });
}
