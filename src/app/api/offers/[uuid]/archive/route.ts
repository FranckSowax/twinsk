import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

// POST: archiver / désarchiver une offre (admin ou collaborateur production/sourcing).
// Body: { archived: boolean } — true = envoie aux archives, false = restaure.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;
  const body = (await request.json().catch(() => ({}))) as { archived?: boolean };
  if (typeof body.archived !== 'boolean') {
    return NextResponse.json({ error: 'Champ archived (booléen) requis' }, { status: 400 });
  }

  const archived_at = body.archived ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin
    .from('offers')
    .update({ archived_at })
    .eq('id', uuid)
    .select('id, title, archived_at')
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Offre introuvable' }, { status: 500 });
  }

  await logCollabAction(actor, {
    action: body.archived ? 'archive_offer' : 'unarchive_offer',
    target_type: 'offer',
    target_id: uuid,
    description: `${body.archived ? 'Archivage' : 'Désarchivage'} : ${data.title}`,
  });

  return NextResponse.json({ success: true, archived_at: data.archived_at });
}
