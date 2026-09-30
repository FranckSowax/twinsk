import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse } from '@/lib/projects/auth';
import { generatePlanFromBrief } from '@/lib/projects/ai-server';

// POST { action: 'plan', brief, currency? } : plan de projet proposé par l'IA
// (Kimi via OpenRouter). Rien n'est créé : l'équipe relit puis crée.
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const b = (await request.json().catch(() => ({}))) as { action?: string; brief?: string; currency?: string };
  try {
    if (b.action !== 'plan') return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    const r = await generatePlanFromBrief(String(b.brief || ''), /^[A-Z]{3}$/.test(String(b.currency || '')) ? String(b.currency) : 'EUR', actor);
    return NextResponse.json(r);
  } catch (e) {
    return errorResponse(e);
  }
}
