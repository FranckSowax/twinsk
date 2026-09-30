import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse } from '@/lib/projects/auth';
import { signedDocumentUrl } from '@/lib/projects/data';

// GET (équipe) : redirige vers un lien signé de 15 min sur le bucket privé ;
// ouverture dans le navigateur par défaut, ?download=1 pour enregistrer le fichier.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id, docId } = await params;
  try {
    const s = await signedDocumentUrl(id, docId, { allowInternal: true, download: request.nextUrl.searchParams.get('download') === '1' });
    if (!s) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    return NextResponse.redirect(s.url, 302);
  } catch (e) {
    return errorResponse(e);
  }
}
