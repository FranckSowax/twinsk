import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { buildDailyReport } from '@/lib/conversation-analysis/service';
import { isDayKey } from '@/lib/conversation-analysis/days';

// GET/POST : (re)génère le rapport d'un jour (heure du pays ; ?date=AAAA-MM-JJ,
// défaut aujourd'hui), idempotent. Analyse d'abord les conversations actives
// du jour qui ne l'ont pas encore été. Appelable par un cron (CRON_SECRET) ou
// par l'admin connecté.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
  if (!(secret && key === secret) && !isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const date = request.nextUrl.searchParams.get('date');
  const r = await buildDailyReport(isDayKey(date) ? { day: date } : {});
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
export const GET = handle;
export const POST = handle;
