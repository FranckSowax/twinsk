import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY } from '@/config/countries';
import { hourInCountry } from '@/lib/country';
import { bucketKey } from '@/lib/admin-activity';
import { buildDailyReport, reportByDate, runAnalysisBatch } from '@/lib/conversation-analysis/service';
import { dayBounds } from '@/lib/conversation-analysis/days';

// GET/POST : passage horaire (service cron Railway). Analyse les conversations
// modifiées depuis leur dernière analyse et calmes depuis 30 min, dans la
// limite du lot et du plafond de coût du jour. À partir de 21 h (heure du
// pays), produit le rapport du jour (en analysant d'abord toutes les
// conversations actives du jour) ; le lendemain, complète le rapport de la
// veille s'il a été produit avant minuit (messages arrivés après 21 h).
// Sécurisé par CRON_SECRET (?key= ou en-tête x-cron-key).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const batch = await runAnalysisBatch();
  let report: { ok: boolean; day?: string; error?: string } | null = null;
  const now = new Date();
  const today = bucketKey(now.toISOString(), 'day', COUNTRY.timezone);
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  const yReport = await reportByDate(yesterday).catch(() => null);
  const yEnd = dayBounds(yesterday, COUNTRY.timezone).end;
  if (!yReport || !yReport.updated_at || yReport.updated_at < yEnd) {
    // Rapport d'hier absent ou figé avant minuit : on le complète (état à la fin du jour).
    const r = await buildDailyReport({ day: yesterday, now });
    report = { ok: r.ok, day: yesterday, error: r.error };
  } else if (hourInCountry() >= 21 && !(await reportByDate(today).catch(() => null))) {
    const r = await buildDailyReport({ day: today, now });
    report = { ok: r.ok, day: today, error: r.error };
  }
  console.log(`[analysis] passage : ${batch.analyzed} analysée(s), ${batch.skipped} ignorée(s), ${batch.costFcfa} FCFA${batch.errors.length ? `, erreurs : ${batch.errors.slice(0, 3).join(' | ')}` : ''}${report ? `, rapport ${report.day} : ${report.ok ? 'ok' : report.error}` : ''}`);
  return NextResponse.json({ ...batch, report });
}
export const GET = handle;
export const POST = handle;
