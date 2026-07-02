import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Webhook WHAPI (appelé par les serveurs WHAPI). PUBLIC mais protégé par un secret
// passé en query (?secret=WHAPI_WEBHOOK_SECRET). Capte les votes de sondage (poll_update).

interface PollResult { name?: string; count?: number; voters?: string[]; id?: string }
interface WhapiMessage {
  id?: string;
  type?: string;
  chat_id?: string;
  poll?: { title?: string; results?: PollResult[] };
}

export async function POST(request: NextRequest) {
  const secret = process.env.WHAPI_WEBHOOK_SECRET;
  // Si un secret est configuré, il DOIT correspondre. Sinon on rejette (pas de webhook non protégé).
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { messages?: WhapiMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];

  for (const m of messages) {
    if (m.type !== 'poll_update' || !m.id || !m.poll) continue;
    const results = Array.isArray(m.poll.results) ? m.poll.results : [];
    const totalVotes = results.reduce((s, r) => s + (Number(r.count) || 0), 0);
    await supabaseAdmin.from('whapi_polls').upsert(
      {
        id: m.id,
        chat_id: m.chat_id ?? null,
        title: m.poll.title ?? null,
        results,
        total_votes: totalVotes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  }

  // Toujours répondre 200 rapidement pour éviter les retries WHAPI.
  return NextResponse.json({ ok: true });
}
