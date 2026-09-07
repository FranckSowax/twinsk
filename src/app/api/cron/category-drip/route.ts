import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/public-origin';
import { runAllDrips, runDrip } from '@/lib/wa-drip-run';
import { parseDripSlot } from '@/lib/wa-drip';

// GET/POST : publie UNE catégorie du listing sur les canaux actifs (groupe,
// statut, chaîne, Facebook, Instagram). À appeler toutes les heures par un cron
// (service Railway `curl`), sécurisé par CRON_SECRET. Fenêtre horaire (heure de
// Libreville) et verrou « une fois par heure » gérés dans runDrip : le cron peut
// repasser sans doublon.
//   ?dry=1   → montre ce qui partirait, sans rien envoyer
//   ?force=1 → ignore la fenêtre et le verrou (tests)

export const maxDuration = 300;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
  if (!secret || key !== secret) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const base = {
    origin: publicOrigin(request),
    dry: request.nextUrl.searchParams.get('dry') === '1',
    force: request.nextUrl.searchParams.get('force') === '1',
    actor: 'cron',
  };
  // ?slot=N → une seule campagne ; sinon toutes, l'une après l'autre.
  const slotParam = request.nextUrl.searchParams.get('slot');
  if (slotParam) {
    const result = await runDrip({ ...base, slot: parseDripSlot(slotParam) });
    if ('error' in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }
  const campaigns = await runAllDrips(base);
  return NextResponse.json({ campaigns });
}

export const GET = handle;
export const POST = handle;
