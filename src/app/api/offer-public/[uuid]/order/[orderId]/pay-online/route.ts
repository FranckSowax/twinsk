import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { settlePromoForOrder } from '@/lib/promo-settle';
import { publicOrigin } from '@/lib/public-origin';
import { settlementCurrencyOf } from '@/lib/offer-pricing';
import { isLocalCurrency } from '@/lib/local-currency';
import { orderNumber } from '@/lib/order-number';
import { COUNTRY } from '@/config/countries';
import { PAYMENT_METHODS } from '@/lib/payments/methods';
import { createInvoice, paydunyaChannels, paydunyaConfig } from '@/lib/payments/paydunya';

// POST : paiement mobile money via l'agrégateur (PayDunya).
// Crée une facture PayDunya, l'enregistre dans `payments` (statut pending) et
// renvoie l'adresse de la page de paiement. La commande n'est validée que par
// l'IPN ou par la vérification au retour du client (lib/payments/settle.ts).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  const method = PAYMENT_METHODS.find((m) => m.id === 'paydunya');
  if (!method) return NextResponse.json({ error: 'Moyen de paiement indisponible' }, { status: 404 });
  const cfg = paydunyaConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: 'Paiement mobile money pas encore activé. Choisissez le paiement en espèces ou écrivez-nous sur WhatsApp.' },
      { status: 503 },
    );
  }

  const { uuid, orderId } = await params;
  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_name, client_phone, transport_mode, grand_total_fcfa, payment_status, offers(title, offer_currency)')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  if (!order.client_name?.trim() || !order.client_phone?.trim()) {
    return NextResponse.json(
      { error: 'Renseignez vos coordonnées (nom + WhatsApp) avant de finaliser' },
      { status: 400 },
    );
  }
  if (order.payment_status === 'paid') return NextResponse.json({ error: 'Commande déjà payée' }, { status: 409 });
  if (order.transport_mode === 'quote') {
    return NextResponse.json({ error: 'Paiement non disponible pour les demandes de devis' }, { status: 400 });
  }
  const offerMeta = order.offers as { title?: string; offer_currency?: string | null } | null;
  if (!isLocalCurrency(settlementCurrencyOf(offerMeta?.offer_currency))) {
    return NextResponse.json({ error: 'Paiement mobile money disponible en FCFA uniquement' }, { status: 400 });
  }

  // Code promo : re-validé au moment de payer, comme pour les autres moyens.
  const promo = await settlePromoForOrder(orderId);
  if (!promo.ok) {
    return NextResponse.json({ error: promo.reason, promo_removed: true }, { status: 409 });
  }
  // Total relu APRÈS la validation du code promo (il a pu être retiré).
  const { data: fresh } = await supabaseAdmin.from('offer_orders').select('grand_total_fcfa').eq('id', orderId).single();
  const amount = Math.round(Number(fresh?.grand_total_fcfa) || 0);
  if (amount <= 0) {
    return NextResponse.json({ error: 'Total invalide — sélectionnez un transport' }, { status: 400 });
  }

  const origin = publicOrigin(request);
  const orderUrl = `${origin}/offer/${uuid}/order/${orderId}`;
  const num = orderNumber(orderId);
  const inv = await createInvoice(cfg, {
    amount,
    description: `Commande ${num} — ${COUNTRY.brand}${offerMeta?.title ? ` (${offerMeta.title})` : ''}`,
    storeName: COUNTRY.brand,
    websiteUrl: origin,
    customer: { name: order.client_name, phone: order.client_phone },
    channels: paydunyaChannels(COUNTRY.code, method.operators || []),
    returnUrl: `${orderUrl}?payment=return`,
    cancelUrl: `${orderUrl}?payment=cancel`,
    callbackUrl: `${origin}/api/payments/paydunya/ipn`,
    customData: { order_id: orderId, offer_id: uuid, order_number: num },
  });
  if (!inv.ok) {
    console.error('[paydunya] création de facture refusée :', inv.error);
    return NextResponse.json({ error: 'Le service de paiement ne répond pas. Réessayez dans un instant.' }, { status: 502 });
  }

  // Référence unique (provider, provider_ref) : l'IPN et le retour client s'y rattachent.
  const { error: payErr } = await supabaseAdmin.from('payments').upsert(
    { provider: 'paydunya', provider_ref: inv.token, order_id: orderId, amount, currency: COUNTRY.currency, status: 'pending' },
    { onConflict: 'provider,provider_ref', ignoreDuplicates: true },
  );
  if (payErr) {
    console.error('[paydunya] enregistrement du paiement impossible :', payErr.message);
    return NextResponse.json({ error: 'Erreur interne, réessayez' }, { status: 500 });
  }
  await supabaseAdmin.from('offer_orders').update({ payment_method: 'paydunya', payment_status: 'pending' }).eq('id', orderId).neq('payment_status', 'paid');

  return NextResponse.json({ success: true, redirect_url: inv.checkoutUrl });
}
