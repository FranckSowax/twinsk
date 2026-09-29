import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { analyzeConversation, latestAnalysis } from '@/lib/conversation-analysis/service';

// POST : ré-analyse manuelle d'une conversation (bouton « Ré-analyser »).
// GET  : dernière analyse enregistrée.
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await inboxActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ analysis: await latestAnalysis(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await inboxActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const r = await analyzeConversation(id, { force: true, triggeredBy: actor.name });
  if (!r.ok) return NextResponse.json({ error: r.skipped ? `Analyse impossible : ${r.skipped}` : r.error || 'Analyse impossible' }, { status: r.skipped ? 400 : 502 });
  return NextResponse.json({ analysis: await latestAnalysis(id), usage: r.usage });
}
