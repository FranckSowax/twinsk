import { NextRequest, NextResponse } from 'next/server';
import { clientActor, errorResponse } from '@/lib/projects/auth';
import { signedCoverUrl } from '@/lib/projects/data';

// GET (client) : vidéo de couverture du projet, par redirection vers un lien signé d'une heure.
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const c = await clientActor(token);
    if (!c) return NextResponse.json({ error: 'Lien invalide, expiré ou révoqué' }, { status: 404 });
    const url = await signedCoverUrl(c.projectId);
    return url ? NextResponse.redirect(url, 302) : NextResponse.json({ error: 'Aucune vidéo' }, { status: 404 });
  } catch (e) {
    return errorResponse(e);
  }
}
