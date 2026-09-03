import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { settlePromoForOrder } from '@/lib/promo-settle';
import { notifyOrdersGroup } from '@/lib/order-notify';

// POST: Initiate ebilling payment for an order.
// NOTE: This is a STUB. Replace with real ebilling integration once credentials
// are provided. For now it just generates a placeholder reference and marks
// the order as 'pending'. Returns a redirect URL pointing back to the order
// page with a ?payment=mock-success flag.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> }
) {
  const { uuid, orderId } = await params;

  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('*')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }
  // Coordonnées client OBLIGATOIRES avant toute finalisation.
  if (!order.client_name?.trim() || !order.client_phone?.trim()) {
    return NextResponse.json(
      { error: 'Renseignez vos coordonnées (nom + WhatsApp) avant de finaliser' },
      { status: 400 },
    );
  }

  // Code promo : re-validé au moment de payer (fenêtre, quotas), puis confirmé.
  // Si le code n'est plus valable, il est retiré et les totaux recalculés :
  // le client voit le nouveau montant avant de repayer.
  const promo = await settlePromoForOrder(orderId);
  if (!promo.ok) {
    return NextResponse.json({ error: promo.reason, promo_removed: true }, { status: 409 });
  }
  if (order.transport_mode === 'quote') {
    return NextResponse.json(
      { error: 'Paiement non disponible pour les demandes de devis' },
      { status: 400 }
    );
  }
  if (!order.grand_total_fcfa || order.grand_total_fcfa <= 0) {
    return NextResponse.json(
      { error: 'Total invalide — sélectionnez un transport' },
      { status: 400 }
    );
  }

  // STUB ebilling reference
  const ebillingRef = `EBL-${Date.now().toString(36).toUpperCase()}`;

  await supabaseAdmin
    .from('offer_orders')
    .update({
      ebilling_reference: ebillingRef,
      payment_status: 'pending',
    })
    .eq('id', orderId);

  // Récap détaillé (produits + liens 1688) dans le groupe 🧾 Commandes Oh My Gab.
  await notifyOrdersGroup(orderId, request.nextUrl.origin);

  // Real integration: call ebilling API with grand_total_fcfa + client_phone,
  // get back a payment URL, then redirect customer to it.
  const baseUrl = `https://${request.headers.get('host') || 'twinsk-production.up.railway.app'}`;
  const redirectUrl = `${baseUrl}/offer/${uuid}/order/${orderId}?payment=mock-success`;

  return NextResponse.json({
    success: true,
    ebilling_reference: ebillingRef,
    redirect_url: redirectUrl,
    notice:
      "Intégration eBilling en mode stub. Fournissez vos credentials eBilling pour passer en production.",
  });
}
