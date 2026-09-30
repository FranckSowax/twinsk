import { NextRequest, NextResponse } from 'next/server';
import { clientActor, errorResponse } from '@/lib/projects/auth';
import { loadProject } from '@/lib/projects/data';
import { renderProjectQuotePdf } from '@/lib/projects/pdf';
import { toPublicView } from '@/lib/projects/public-server';

// GET (client) : PDF du devis consolidé.
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const c = await clientActor(token);
    if (!c) return NextResponse.json({ error: 'Lien invalide, expiré ou révoqué' }, { status: 404 });
    const b = await loadProject(c.projectId);
    if (!b) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    const p = b.project as { client_company?: string | null; client_name?: string | null };
    const buffer = await renderProjectQuotePdf(toPublicView(b, token), p.client_company || p.client_name || c.actor.name);
    return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="devis-projet.pdf"` } });
  } catch (e) {
    return errorResponse(e);
  }
}
