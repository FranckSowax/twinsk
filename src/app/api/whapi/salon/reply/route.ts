import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { publicOrigin } from '@/lib/public-origin';
import { sendSalonReply } from '@/lib/salon-data';

// POST { request_id, product_ids[], message } → réponse dans le groupe (mention +
// référence, puis fiches produit à bouton), demande marquée « proposition envoyée ».
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { request_id?: string; product_ids?: string[]; message?: string };
  if (!body.request_id) return NextResponse.json({ error: 'Demande requise' }, { status: 400 });
  const r = await sendSalonReply({
    requestId: body.request_id,
    productIds: Array.isArray(body.product_ids) ? body.product_ids.filter((x): x is string => typeof x === 'string') : [],
    message: typeof body.message === 'string' ? body.message : '',
    origin: publicOrigin(request),
  });
  return NextResponse.json({ success: r.ok, ...r });
}
