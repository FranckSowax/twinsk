import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';

// GET: dernières exécutions de chaque rituel (admin ou collaborateur "commandes").
export async function GET(request: NextRequest) {
  if (!(await resolveActor(request, ['commandes']))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('playbook_log')
    .select('ritual, note, done_by, done_at')
    .order('done_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Dernière date par rituel (la liste est déjà triée du plus récent au plus ancien).
  const last: Record<string, { done_at: string; done_by: string | null }> = {};
  for (const row of data || []) {
    if (!last[row.ritual]) last[row.ritual] = { done_at: row.done_at, done_by: row.done_by };
  }
  return NextResponse.json({ last, recent: (data || []).slice(0, 20) });
}

// POST: marquer un rituel comme fait { ritual, note? }.
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request, ['commandes']);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { ritual?: string; note?: string };
  const ritual = (body.ritual || '').trim();
  if (!ritual) return NextResponse.json({ error: 'Rituel requis' }, { status: 400 });

  const done_by = actor.role === 'admin' ? 'admin' : actor.collaborator.name;
  const { error } = await supabaseAdmin
    .from('playbook_log')
    .insert({ ritual, note: body.note?.trim() || null, done_by });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
