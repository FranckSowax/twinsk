import { NextRequest, NextResponse } from 'next/server';
import { resolveActor, logCollabAction } from '@/lib/collab';
import { addParcelPhotos, isPhotoStage } from '@/lib/order-photos';

// POST: un collaborateur "commandes" (Anna en Chine) ajoute des photos de colis.
// Body: { urls: string[], stage?: 'china' | 'gabon' }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const actor = await resolveActor(request, ['commandes']);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId } = await params;

  const body = (await request.json().catch(() => ({}))) as { urls?: unknown; stage?: unknown };
  const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string') : [];
  if (!urls.length) return NextResponse.json({ error: 'Aucune photo' }, { status: 400 });
  const stage = isPhotoStage(body.stage) ? body.stage : 'china';

  const by = actor.role === 'collab' ? actor.collaborator.name : 'Admin';
  const photos = await addParcelPhotos({ orderId, urls, stage, by });
  if (!photos) {
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  await logCollabAction(actor, {
    action: 'order_photos',
    target_type: 'order',
    target_id: orderId,
    description: `${urls.length} photo(s) — ${stage === 'china' ? 'Chine' : 'Gabon'}`,
  });
  return NextResponse.json({ success: true, parcel_photos: photos });
}
