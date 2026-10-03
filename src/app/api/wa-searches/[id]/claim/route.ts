import { NextRequest, NextResponse } from 'next/server';
import { claimWaSearch } from '@/lib/inbox-research-data';
import { WA_SEARCH_ROLES } from '@/lib/collab-roles';
import { waSearchActor } from '@/lib/wa-search-actor';

// POST : l'agent (ou un collaborateur) prend la recherche en charge — elle passe
// « En recherche » et n'est pas reprise par un autre pendant 6 h. 409 si déjà prise.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await waSearchActor(request, WA_SEARCH_ROLES);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const r = await claimWaSearch(id, actor.name);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 500 });
  return NextResponse.json({ success: true });
}
