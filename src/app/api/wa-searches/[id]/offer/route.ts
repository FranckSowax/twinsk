import { NextRequest, NextResponse } from 'next/server';
import { createSearchOffer } from '@/lib/inbox-research-data';
import { WA_SEARCH_ROLES } from '@/lib/collab-roles';
import { waSearchActor } from '@/lib/wa-search-actor';

// POST { title?, theme? } : crée l'offre B2C en BROUILLON rattachée à la recherche
// (ou renvoie celle déjà rattachée). Les produits se chargent ensuite avec
// POST /api/offers/<offer_id>/bulk-load. Elle n'est publiée qu'à l'envoi au client.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await waSearchActor(request, WA_SEARCH_ROLES))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; theme?: unknown };
  const r = await createSearchOffer(id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    theme: typeof body.theme === 'string' ? body.theme : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, offer_id: r.offerId, admin_url: `/admin/offer/${r.offerId}` });
}
