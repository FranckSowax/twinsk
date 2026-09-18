import { NextRequest, NextResponse } from 'next/server';
import { notifyOrdersGroup } from '@/lib/order-notify';
import { publicOrigin } from '@/lib/public-origin';
import { applyOrderTransport, parseTransportMode } from '@/lib/order-transport';

// PATCH: Customer picks a transport mode ('air' | 'sea' | 'mixed' | 'quote') and we
// persist the corresponding transport_cost + grand_total.
// Body: { transport_mode, split?: { [lineId]: airQty } } — split requis en mode 'mixed'.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> }
) {
  const { uuid, orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as { transport_mode?: unknown; split?: Record<string, unknown> };
  const mode = parseTransportMode(body.transport_mode);
  if (!mode) return NextResponse.json({ error: 'Mode invalide' }, { status: 400 });

  const r = await applyOrderTransport({ orderId, offerId: uuid, mode, split: body.split });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  // Devis transport sur mesure : récap dans le groupe Commandes, une seule fois,
  // et seulement si les coordonnées sont déjà connues (sinon la route .../contact
  // notifiera à la saisie — pas de doublon).
  const o = r.order as { previous_transport_mode?: string | null; client_name?: string | null; client_phone?: string | null };
  if (mode === 'quote' && o.previous_transport_mode !== 'quote' && o.client_name && o.client_phone) {
    await notifyOrdersGroup(orderId, publicOrigin(request)).catch((e) =>
      console.error('[transport] notification devis impossible', e instanceof Error ? e.message : e),
    );
  }
  return NextResponse.json({ success: true, order: r.order, pricing: r.pricing });
}
