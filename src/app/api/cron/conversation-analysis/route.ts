import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY } from '@/config/countries';
import { hourInCountry } from '@/lib/country';
import { bucketKey } from '@/lib/admin-activity';
import { buildDailyReport, reportExists, runAnalysisBatch } from '@/lib/conversation-analysis/service';

// GET/POST : passage horaire (service cron Railway). Analyse les conversations
// modifiées depuis leur dernière analyse et calmes depuis 30 min, dans la
// limite du lot et du plafond de coût du jour. À partir de 21 h (heure du
// pays), produit aussi le rapport du jour s'il n'existe pas encore.
// Sécurisé par CRON_SECRET (?key= ou en-tête x-cron-key).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const batch = await runAnalysisBatch();
  let report: { ok: boolean; error?: string } | null = null;
  const today = bucketKey(new Date().toISOString(), 'day', COUNTRY.timezone);
  if (hourInCountry() >= 21 && !(await reportExists(today).catch(() => true))) {
    const r = await buildDailyReport();
    report = { ok: r.ok, error: r.error };
  }
  console.log(`[analysis] passage : ${batch.analyzed} analysée(s), ${batch.skipped} ignorée(s), ${batch.costFcfa} FCFA${batch.errors.length ? `, erreurs : ${batch.errors.slice(0, 3).join(' | ')}` : ''}${report ? `, rapport : ${report.ok ? 'ok' : report.error}` : ''}`);
  return NextResponse.json({ ...batch, report });
}
export const GET = handle;
export const POST = handle;
