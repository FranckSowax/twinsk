import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/collab';
import { listWaSearches } from '@/lib/inbox-research-data';
import { isWaSearchStatus } from '@/lib/inbox-research';
import { WA_SEARCH_ROLES } from '@/lib/collab-roles';

// GET ?status=new|searching|proposal_sent|done|cancelled : recherches WhatsApp (onglet dédié).
export async function GET(request: NextRequest) {
  if (!(await resolveActor(request, WA_SEARCH_ROLES))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const s = request.nextUrl.searchParams.get('status');
  const r = await listWaSearches(isWaSearchStatus(s) ? s : null);
  if (!r.ok) return NextResponse.json({ error: r.error, missing: r.missing || false, items: [] }, { status: r.missing ? 200 : 500 });
  return NextResponse.json({ items: r.items });
}
