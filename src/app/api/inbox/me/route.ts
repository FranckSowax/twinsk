import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';

export async function GET(request: NextRequest) {
  const actor = await inboxActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  return NextResponse.json({ actor });
}
