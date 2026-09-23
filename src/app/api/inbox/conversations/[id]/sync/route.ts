import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { syncConversationHistory } from '@/lib/wa-inbox-data';

// POST : récupère l'historique WhatsApp de la conversation (messages manquants, liens compris).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await inboxActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const r = await syncConversationHistory(id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ success: true, added: r.added });
}
