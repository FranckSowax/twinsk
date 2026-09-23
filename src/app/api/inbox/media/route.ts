import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { readMediaLibrary } from '@/lib/wa-drip-run';

// GET : médiathèque (photos / vidéos de la diffusion), pour l'envoyer à un client.
export async function GET(request: NextRequest) {
  if (!(await inboxActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  return NextResponse.json({ items: await readMediaLibrary() });
}
