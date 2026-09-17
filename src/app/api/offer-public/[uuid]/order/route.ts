import { NextRequest, NextResponse } from 'next/server';
import { validateContact } from '@/lib/contact-validation';
import { createOfferOrder, type OrderPick } from '@/lib/offer-order-create';
import { notifyOrdersGroup } from '@/lib/order-notify';
import { publicOrigin } from '@/lib/public-origin';

// POST: le client valide sa sélection depuis un listing.
// Body: { picks: [{ product_id, variant_id?, quantity }], affiliate_ref?, client_name?, client_phone?, client_email? }
// Parcours (18 sept. 2026) : le panier devient une commande SANS coordonnées ;
// le client choisit le transport et voit son total, puis saisit nom + WhatsApp
// (route .../contact, obligatoire avant paiement ou devis). Si des coordonnées
// sont envoyées ici (panier admin, anciens clients), elles sont validées.
// La mécanique (prix, marge, lignes, miroir /admin/requests) vit dans createOfferOrder.
export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    picks?: OrderPick[];
    affiliate_ref?: string;
  };

  const hasContact = !!((body.client_name || '').trim() || (body.client_phone || '').trim());
  const contact = hasContact ? validateContact(body.client_name, body.client_phone) : null;
  if (contact && !contact.ok) return NextResponse.json({ error: contact.error, field: 'contact' }, { status: 400 });

  const created = await createOfferOrder({
    offerId: uuid,
    clientName: contact?.ok ? contact.name : undefined,
    clientPhone: contact?.ok ? contact.phone : undefined,
    clientEmail: body.client_email,
    picks: Array.isArray(body.picks) ? body.picks : [],
    affiliateRef: typeof body.affiliate_ref === 'string' ? body.affiliate_ref : undefined,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });

  // Demande de devis pure (toutes les lignes en acompte) avec coordonnées déjà
  // connues : la commande est complète ici → récap dans le groupe Commandes.
  // (Sans coordonnées, c'est la route .../contact qui notifie.)
  if (created.allAcompte && contact?.ok) {
    await notifyOrdersGroup(created.orderId, publicOrigin(request)).catch((e) =>
      console.error('[order] notification devis impossible', e instanceof Error ? e.message : e),
    );
  }
  return NextResponse.json({ success: true, order_id: created.orderId, request_id: created.requestId });
}
