import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/collab';
import { updateWaSearch } from '@/lib/inbox-research-data';
import { isWaSearchStatus } from '@/lib/inbox-research';
import { WA_SEARCH_ROLES } from '@/lib/collab-roles';

// PATCH { status?, note? } : suivi d'une recherche WhatsApp.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await resolveActor(request, WA_SEARCH_ROLES))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: unknown; note?: unknown };
  if (body.status !== undefined && !isWaSearchStatus(body.status)) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  const r = await updateWaSearch(id, {
    status: isWaSearchStatus(body.status) ? body.status : undefined,
    note: body.note === undefined ? undefined : typeof body.note === 'string' ? body.note : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ success: true });
}
