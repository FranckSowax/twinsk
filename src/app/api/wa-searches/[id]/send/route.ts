import { NextRequest, NextResponse } from 'next/server';
import { sendSearchToClient } from '@/lib/inbox-research-data';
import { WA_SEARCH_SEND_ROLES } from '@/lib/collab-roles';
import { waSearchActor } from '@/lib/wa-search-actor';
import { publicOrigin } from '@/lib/public-origin';

// POST : envoie l'offre de la recherche au client sur WhatsApp. Réservé à une
// personne (admin, rôles whatsapp, commandes, production) et seulement après
// la vérification (marges, complétude). Une offre du site en brouillon est publiée.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await waSearchActor(request, WA_SEARCH_SEND_ROLES);
  if (!actor) return NextResponse.json({ error: 'Envoi réservé à l’équipe (admin, WhatsApp, commandes, production).' }, { status: 403 });
  const { id } = await params;
  const r = await sendSearchToClient(id, actor, publicOrigin(request));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, link: r.link });
}
