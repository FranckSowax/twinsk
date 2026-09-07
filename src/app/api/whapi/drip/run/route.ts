import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { publicOrigin } from '@/lib/public-origin';
import { runDrip } from '@/lib/wa-drip-run';
import { parseDripSlot } from '@/lib/wa-drip';

// POST : « Publier maintenant » depuis l'admin — envoie la prochaine catégorie
// tout de suite, hors fenêtre horaire. Body: { advance?: boolean } — true (défaut)
// fait avancer le curseur comme une exécution normale ; false = test qui
// republiera la même catégorie à l'heure suivante.

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { advance?: boolean; dry?: boolean; slot?: number };
  const result = await runDrip({
    origin: publicOrigin(request),
    force: true,
    dry: body.dry === true,
    advance: body.advance !== false,
    actor: 'admin',
    slot: parseDripSlot(body.slot),
  });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
