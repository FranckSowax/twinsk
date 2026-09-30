import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse } from '@/lib/projects/auth';
import { loadProject, markTeamSeen, updateProject } from '@/lib/projects/data';
import { templateByKey } from '@/lib/projects/templates/dom-tom';

// GET : projet complet (équipe : tout, fournisseurs réels et échanges compris).
// PATCH : titre, description, client, statut.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  try {
    const bundle = await loadProject(id);
    if (!bundle) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    await markTeamSeen(id);
    const t = templateByKey(String((bundle.project as { template_key?: string }).template_key || ''));
    return NextResponse.json({ ...bundle, template: t ? { key: t.key, business_trip: t.business_trip, lots: t.lots } : null });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  try {
    await updateProject(id, (await request.json().catch(() => ({}))) as Record<string, string>, actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
