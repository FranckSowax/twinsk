import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { inboxActor } from '@/lib/inbox-actor';
import { readQuickReplies, writeQuickReplies } from '@/lib/wa-inbox-data';

// GET : phrases rapides (tous). PUT { items } : modification (admin seulement).
export async function GET(request: NextRequest) {
  if (!(await inboxActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  return NextResponse.json({ items: await readQuickReplies() });
}
export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Réservé à l’admin' }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { items?: unknown };
  return NextResponse.json({ items: await writeQuickReplies(body.items) });
}
