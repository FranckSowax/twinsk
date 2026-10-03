import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { listConversationResearch, saveConversationResearch } from '@/lib/inbox-research-data';

// Recherches clients d'une conversation (messagerie).
// GET  → recherches créées depuis cette conversation
// POST → { text, message_ids?: string[], request_id?: string } : crée une
//        recherche (ou complète celle indiquée) avec la demande et les photos
//        du client choisies. Les photos sont copiées dans le stockage des
//        recherches (fichier complet lu chez WhatsApp).
export const maxDuration = 120;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await inboxActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ items: await listConversationResearch(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await inboxActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; message_ids?: unknown; request_id?: unknown };
  const r = await saveConversationResearch({
    conversationId: id,
    actor,
    text: typeof body.text === 'string' ? body.text : '',
    messageIds: Array.isArray(body.message_ids) ? body.message_ids.filter((x): x is string => typeof x === 'string') : [],
    requestId: typeof body.request_id === 'string' && body.request_id ? body.request_id : null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
