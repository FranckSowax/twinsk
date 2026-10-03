import { NextRequest, NextResponse } from 'next/server';
import { getWaSearch, updateWaSearch } from '@/lib/inbox-research-data';
import { isWaSearchStatus } from '@/lib/inbox-research';
import { WA_SEARCH_ROLES, WA_SEARCH_SEND_ROLES } from '@/lib/collab-roles';
import { waSearchActor } from '@/lib/wa-search-actor';

// GET : une recherche WhatsApp (demande, photos, interprétation, offre, suivi).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await waSearchActor(request, WA_SEARCH_ROLES))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const s = await getWaSearch(id);
  if (!s) return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 });
  return NextResponse.json({ search: s });
}

// PATCH { status?, note?, interpretation?, offer_url?, offer_id?, checked? } : suivi d'une recherche.
// `checked` (vérification des marges et de la complétude) : réservé à une personne
// (rôles whatsapp, commandes, production et admin), pas à l'agent.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await waSearchActor(request, WA_SEARCH_ROLES);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.status !== undefined && !isWaSearchStatus(body.status)) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  if (body.checked !== undefined && !(await waSearchActor(request, WA_SEARCH_SEND_ROLES))) {
    return NextResponse.json({ error: 'La vérification est faite par une personne de l’équipe.' }, { status: 403 });
  }
  const str = (v: unknown) => (v === undefined ? undefined : typeof v === 'string' ? v : null);
  const r = await updateWaSearch(
    id,
    {
      status: isWaSearchStatus(body.status) ? body.status : undefined,
      note: str(body.note),
      interpretation: str(body.interpretation),
      offer_url: str(body.offer_url),
      offer_id: str(body.offer_id),
      checked: typeof body.checked === 'boolean' ? body.checked : undefined,
    },
    actor.name,
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 500 });
  return NextResponse.json({ success: true });
}
