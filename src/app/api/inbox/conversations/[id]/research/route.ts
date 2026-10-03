import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { listConversationSearches, saveConversationSearch } from '@/lib/inbox-research-data';

// Recherches WhatsApp d'une conversation (messagerie, bouton « Recherche »).
// GET  → recherches de cette conversation
// POST → { text, message_ids?: string[], search_id?: string } : crée une
//        recherche (ou complète celle indiquée) avec la demande et les photos du
//        client choisies, copiées dans le stockage (fichier complet lu chez WhatsApp).
export const maxDuration = 120;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await inboxActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const r = await listConversationSearches(id);
  if (!r.ok) return NextResponse.json({ error: r.error, missing: r.missing || false, items: [] }, { status: r.missing ? 200 : 500 });
  return NextResponse.json({ items: r.items });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await inboxActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; message_ids?: unknown; search_id?: unknown };
  const r = await saveConversationSearch({
    conversationId: id,
    actor,
    text: typeof body.text === 'string' ? body.text : '',
    messageIds: Array.isArray(body.message_ids) ? body.message_ids.filter((x): x is string => typeof x === 'string') : [],
    searchId: typeof body.search_id === 'string' && body.search_id ? body.search_id : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
