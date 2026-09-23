import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/collab';
import { INBOX_ROLES } from '@/lib/collab-roles';
import { publicOrigin } from '@/lib/public-origin';
import { sendClientCartWhatsapp } from '@/lib/client-cart-send';

// POST : (re)envoie un panier enregistré sur le WhatsApp du client.
// Body: { message? }
export const maxDuration = 180;

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!(await resolveActor(request, INBOX_ROLES))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const r = await sendClientCartWhatsapp({ orderId, origin: publicOrigin(request), message: body.message });
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: r.errors.length === 0, ...r });
}
