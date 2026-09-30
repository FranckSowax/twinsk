import { NextRequest, NextResponse } from 'next/server';
import { clientActor, errorResponse } from '@/lib/projects/auth';
import { signedDocumentUrl } from '@/lib/projects/data';

// GET (client) : lien signé de 15 min ; les documents internes restent inaccessibles.
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  try {
    const c = await clientActor(token);
    if (!c) return NextResponse.json({ error: 'Lien invalide, expiré ou révoqué' }, { status: 404 });
    const s = await signedDocumentUrl(c.projectId, docId, { allowInternal: false });
    if (!s) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    return NextResponse.redirect(s.url, 302);
  } catch (e) {
    return errorResponse(e);
  }
}
