import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/collab';
import { parsePeriod, periodStart } from '@/lib/admin-activity';
import { aggregateReport } from '@/lib/conversation-analysis/report';
import { analyzedConversationsSince, latestReport, pendingCarts, reportByDate, reportDates } from '@/lib/conversation-analysis/service';
import { isDayKey } from '@/lib/conversation-analysis/days';
import { llmConfigured, llmKeyVar, llmModel, llmProvider } from '@/lib/llm';

// GET ?period=7|30|90|all : synthèse des analyses IA (dernière analyse de
// chaque conversation analysée sur la période) + dernier rapport quotidien.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await resolveActor(request, ['commandes', 'whatsapp']))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const period = parsePeriod(request.nextUrl.searchParams.get('period'));
  const llm = { provider: llmProvider(), model: llmModel(), configured: llmConfigured(), keyVar: llmKeyVar() };
  try {
    const date = request.nextUrl.searchParams.get('report');
    const [{ rows, cost }, report, carts, dates] = await Promise.all([analyzedConversationsSince(periodStart(period)), isDayKey(date) ? reportByDate(date) : latestReport(), pendingCarts(), reportDates()]);
    return NextResponse.json({ period, breakdown: aggregateReport(rows), costFcfa: Math.round(cost * 100) / 100, pendingCarts: carts, report, reportDates: dates, llm, available: true });
  } catch (e) {
    return NextResponse.json({ period, available: false, error: e instanceof Error ? e.message : 'Erreur', llm });
  }
}
