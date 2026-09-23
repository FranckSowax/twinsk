import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { sendInboxReply } from '@/lib/wa-inbox-data';
import type { InboxMediaKind } from '@/lib/wa-inbox';

// POST { text } ou { media: { url, kind, caption?, filename? }, text? } : réponse WhatsApp au client.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await inboxActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { text?: string; media?: { url?: string; kind?: string; caption?: string; filename?: string } };
  let media: { url: string; kind: InboxMediaKind; caption?: string; filename?: string } | undefined;
  if (body.media) {
    const kind = body.media.kind;
    if (!body.media.url || !/^https?:\/\//.test(body.media.url) || (kind !== 'image' && kind !== 'video' && kind !== 'document')) {
      return NextResponse.json({ error: 'Média invalide (url publique + kind image | video | document)' }, { status: 400 });
    }
    media = { url: body.media.url, kind, caption: body.media.caption, filename: body.media.filename };
  }
  const r = await sendInboxReply(id, actor, { text: typeof body.text === 'string' ? body.text : '', media });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ success: true, message: r.message });
}
