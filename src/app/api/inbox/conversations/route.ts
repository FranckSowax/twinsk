import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { inboxCounts, listConversations } from '@/lib/wa-inbox-data';
import type { InboxFilter } from '@/lib/wa-inbox';

// GET ?filter=todo|mine|all|closed&q=… : conversations + compteurs des filtres.
export async function GET(request: NextRequest) {
  const actor = await inboxActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const f = request.nextUrl.searchParams.get('filter') || 'todo';
  const filter: InboxFilter = f === 'mine' || f === 'all' || f === 'closed' ? f : 'todo';
  try {
    const [conversations, counts] = await Promise.all([listConversations(filter, actor, request.nextUrl.searchParams.get('q') || ''), inboxCounts(actor)]);
    return NextResponse.json({ conversations, counts, actor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    // Tables absentes tant que la migration 59 n'est pas appliquée : message explicite.
    const hint = /wa_conversations|does not exist/i.test(msg) ? 'Migration 59 non appliquée (tables wa_conversations / wa_messages).' : msg;
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
