import { NextRequest, NextResponse } from 'next/server';
import { clientActor, errorResponse } from '@/lib/projects/auth';
import { loadProject } from '@/lib/projects/data';
import { toPublicView } from '@/lib/projects/public-server';

// GET (client, lien à jeton) : projection publique filtrée du projet.
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const c = await clientActor(token);
    if (!c) return NextResponse.json({ error: 'Lien invalide, expiré ou révoqué' }, { status: 404 });
    const bundle = await loadProject(c.projectId);
    if (!bundle) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    return NextResponse.json({ viewer: { name: c.actor.name }, project: toPublicView(bundle, token) });
  } catch (e) {
    return errorResponse(e);
  }
}
