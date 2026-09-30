import { NextRequest, NextResponse } from 'next/server';
import { hourInCountry } from '@/lib/country';
import { publicOrigin } from '@/lib/public-origin';
import { projectsEnabled } from '@/lib/projects/data';
import { dispatchProjectNotifications, remindMissingUpdates } from '@/lib/projects/notify';

// GET/POST (service cron Railway, toutes les 15 min) : envoie les notifications
// de projet en attente ; le matin (9 h-11 h, heure du pays), rappelle à l'équipe
// les projets sans mise à jour la veille ouvrée. Sécurisé par CRON_SECRET.
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (!projectsEnabled()) return NextResponse.json({ skipped: 'module Twinsk absent dans ce pays' });
  const origin = publicOrigin(request);
  const sent = await dispatchProjectNotifications(origin);
  const h = hourInCountry();
  const reminder = h >= 9 && h < 11 ? await remindMissingUpdates(origin) : { reminded: [] };
  console.log(`[projects] cron : ${sent.client} au client, ${sent.team} à l'équipe, ${sent.skipped} sans destinataire${sent.errors.length ? `, erreurs : ${sent.errors.join(' | ')}` : ''}${reminder.reminded.length ? `, rappel journal : ${reminder.reminded.join(', ')}` : ''}`);
  return NextResponse.json({ ...sent, reminder });
}
export const GET = handle;
export const POST = handle;
