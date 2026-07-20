import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

// GET: liste des phases d'une offre (ordonnées).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;
  const { data, error } = await supabaseAdmin
    .from('offer_phases')
    .select('id, title, position')
    .eq('offer_id', uuid)
    .order('position');
  if (error) return NextResponse.json({ phases: [], warning: error.message });
  return NextResponse.json({ phases: data || [] });
}

// POST: créer une phase. Body: { title }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;
  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const title = (body.title || '').trim();

  const { data: last } = await supabaseAdmin
    .from('offer_phases')
    .select('position')
    .eq('offer_id', uuid)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number) ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from('offer_phases')
    .insert({ offer_id: uuid, title: title || `Phase ${position + 1}`, position })
    .select('id, title, position')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logCollabAction(actor, { action: 'add_phase', target_type: 'offer', target_id: uuid, description: `Phase ajoutée : ${data.title}` });
  return NextResponse.json(data);
}

// PUT: réordonner les phases. Body: { orderedIds: string[] }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;
  const body = (await request.json().catch(() => ({}))) as { orderedIds?: string[] };
  const ids = Array.isArray(body.orderedIds) ? body.orderedIds.filter((v) => typeof v === 'string') : [];
  if (!ids.length) return NextResponse.json({ error: 'orderedIds requis' }, { status: 400 });
  await Promise.all(
    ids.map((id, index) =>
      supabaseAdmin.from('offer_phases').update({ position: index }).eq('id', id).eq('offer_id', uuid),
    ),
  );
  return NextResponse.json({ success: true });
}
