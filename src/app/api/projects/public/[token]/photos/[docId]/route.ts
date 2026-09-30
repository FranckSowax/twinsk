import { NextRequest, NextResponse } from 'next/server';
import { clientActor, errorResponse } from '@/lib/projects/auth';
import { signedSupplierPhotoUrl } from '@/lib/projects/data';

// GET (client) : photo d'un produit d'usine, seulement si elle figure dans une fiche usine du projet.
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  try {
    const c = await clientActor(token);
    if (!c) return NextResponse.json({ error: 'Lien invalide, expiré ou révoqué' }, { status: 404 });
    const url = await signedSupplierPhotoUrl(c.projectId, docId);
    return url ? NextResponse.redirect(url, 302) : NextResponse.json({ error: 'Photo introuvable' }, { status: 404 });
  } catch (e) {
    return errorResponse(e);
  }
}
