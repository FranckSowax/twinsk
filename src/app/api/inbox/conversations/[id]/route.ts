import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { getConversation, listMessages, updateConversation } from '@/lib/wa-inbox-data';

// GET : conversation + fil. PATCH { assign: 'me' | null, status, note }.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await inboxActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });
  const messages = await listMessages(id);
  return NextResponse.json({ conversation, messages });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await inboxActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { assign?: 'me' | null; status?: string; note?: string };
  const status = body.status === 'open' || body.status === 'replied' || body.status === 'closed' ? body.status : undefined;
  if (body.status !== undefined && !status) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  try {
    const conversation = await updateConversation(id, actor, { assign: body.assign, status, note: typeof body.note === 'string' ? body.note : undefined });
    return NextResponse.json({ conversation });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
