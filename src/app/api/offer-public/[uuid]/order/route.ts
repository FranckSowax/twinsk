import { NextRequest, NextResponse } from 'next/server';
import { validateContact } from '@/lib/contact-validation';
import { createOfferOrder, type OrderPick } from '@/lib/offer-order-create';
import { notifyOrdersGroup } from '@/lib/order-notify';
import { publicOrigin } from '@/lib/public-origin';

// POST: le client valide sa sélection depuis un listing.
// Body: { client_name, client_phone, client_email?, picks: [{ product_id, variant_id?, quantity }], affiliate_ref? }
// Coordonnées OBLIGATOIRES (décision du 5 sept. 2026) : pas de commande sans
// un nom et un numéro WhatsApp joignable. La mécanique (prix, marge, lignes,
// miroir /admin/requests) vit dans createOfferOrder.
export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    picks?: OrderPick[];
    affiliate_ref?: string;
  };

  const contact = validateContact(body.client_name, body.client_phone);
  if (!contact.ok) return NextResponse.json({ error: contact.error, field: 'contact' }, { status: 400 });

  const created = await createOfferOrder({
    offerId: uuid,
    clientName: contact.name,
    clientPhone: contact.phone,
    clientEmail: body.client_email,
    picks: Array.isArray(body.picks) ? body.picks : [],
    affiliateRef: typeof body.affiliate_ref === 'string' ? body.affiliate_ref : undefined,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });

  // Demande de devis pure (toutes les lignes en acompte) : pas de transport ni
  // de paiement, la commande est complète ici → récap dans le groupe Commandes.
  if (created.allAcompte) {
    await notifyOrdersGroup(created.orderId, publicOrigin(request)).catch((e) =>
      console.error('[order] notification devis impossible', e instanceof Error ? e.message : e),
    );
  }
  return NextResponse.json({ success: true, order_id: created.orderId, request_id: created.requestId });
}
