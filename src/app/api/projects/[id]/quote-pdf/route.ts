import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse } from '@/lib/projects/auth';
import { loadProject } from '@/lib/projects/data';
import { renderProjectQuotePdf } from '@/lib/projects/pdf';
import { toPublicView } from '@/lib/projects/public-server';

// GET (équipe) : PDF du devis consolidé, construit depuis la vue client (aucune donnée interne).
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  try {
    const b = await loadProject(id);
    if (!b) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    const p = b.project as { client_company?: string | null; client_name?: string | null };
    const buffer = await renderProjectQuotePdf(toPublicView(b, 'equipe'), p.client_company || p.client_name || 'Client');
    return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="devis-projet-${id.slice(0, 8)}.pdf"` } });
  } catch (e) {
    return errorResponse(e);
  }
}
