import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';
import { logAgentAction } from '@/lib/agent-actions';
import { addParcelPhotos, isPhotoStage } from '@/lib/order-photos';

// POST: un agent (Ruth au Gabon) ajoute des photos de colis à une commande.
// Body: { urls: string[], stage?: 'gabon' | 'china' }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { urls?: unknown; stage?: unknown };
  const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string') : [];
  if (!urls.length) return NextResponse.json({ error: 'Aucune photo' }, { status: 400 });
  const stage = isPhotoStage(body.stage) ? body.stage : 'gabon';

  const photos = await addParcelPhotos({ orderId: id, urls, stage, by: agent.name });
  if (!photos) {
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  await logAgentAction(agent.id, id, 'photos', { count: urls.length, stage });
  return NextResponse.json({ success: true, parcel_photos: photos });
}
