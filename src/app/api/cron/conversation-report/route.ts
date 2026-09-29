import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { buildDailyReport } from '@/lib/conversation-analysis/service';

// GET/POST : (re)génère le rapport du jour (heure du pays), idempotent.
// Appelable par un cron (CRON_SECRET) ou par l'admin connecté.
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
  if (!(secret && key === secret) && !isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const r = await buildDailyReport();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
export const GET = handle;
export const POST = handle;
