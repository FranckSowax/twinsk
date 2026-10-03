import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { publicOrigin } from '@/lib/public-origin';
import { runDrip } from '@/lib/wa-drip-run';
import { parseDripSlot } from '@/lib/wa-drip';

// POST : « Publier maintenant » depuis l'admin — envoie tout de suite, hors
// créneau, la prochaine catégorie (flux produits) et/ou les prochaines annonces.
// Body: { slot, flux?: 'products' | 'announcements' | 'all', dry?: boolean,
// advance?: boolean } — advance true (défaut) fait avancer le curseur comme une
// exécution normale ; false = test qui republiera la même chose au créneau suivant.

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { advance?: boolean; dry?: boolean; slot?: number; flux?: string };
  const flux = body.flux === 'products' || body.flux === 'announcements' ? body.flux : 'all';
  const result = await runDrip({
    origin: publicOrigin(request),
    force: true,
    dry: body.dry === true,
    advance: body.advance !== false,
    actor: 'admin',
    slot: parseDripSlot(body.slot),
    flux,
  });
  if (result.error) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
