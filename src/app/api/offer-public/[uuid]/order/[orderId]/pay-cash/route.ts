import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { formatSettlement, settlementCurrencyOf } from '@/lib/offer-pricing';
import { settlePromoForOrder } from '@/lib/promo-settle';
import { sendWhapiText } from '@/lib/whapi';
import { orderNumber, toWhatsappChatId } from '@/lib/order-number';
import { notifyOrdersGroup } from '@/lib/order-notify';
import { COUNTRY } from '@/config/countries';
import { publicOrigin } from '@/lib/public-origin';
import { isPaymentMethodEnabled } from '@/lib/payments/methods';

// POST: le client choisit de payer CASH en agence.
// - Réserve la commande (payment_method='cash', payment_status='submitted').
// - Envoie au client un message WHAPI : n° de commande + lien récap + « agence sous 48h ».
// - Notifie le groupe Staff WhatsApp (env WHAPI_STAFF_GROUP_ID) de la nouvelle commande.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  if (!isPaymentMethodEnabled('cash')) {
    return NextResponse.json({ error: 'Moyen de paiement indisponible' }, { status: 404 });
  }
  const { uuid, orderId } = await params;

  // Coordonnées client OBLIGATOIRES avant toute finalisation.
  const { data: existing } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_name, client_phone')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (!existing) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }
  if (!existing.client_name?.trim() || !existing.client_phone?.trim()) {
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

  const { data: order, error } = await supabaseAdmin
    .from('offer_orders')
    .update({ payment_method: 'cash', payment_status: 'submitted' })
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .select('id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, offers(title, offer_currency)')
    .single();
  if (error || !order) {
    return NextResponse.json({ error: error?.message || 'Commande introuvable' }, { status: 500 });
  }

  const num = orderNumber(order.id);
  const total = Number(order.grand_total_fcfa ?? order.items_total_fcfa) || 0;
  const offerMeta = order.offers as { title?: string; offer_currency?: string | null } | null;
  const totalStr = formatSettlement(total, settlementCurrencyOf(offerMeta?.offer_currency));
  const recapUrl = `${publicOrigin(request)}/offer/${uuid}/order/${orderId}`;
  const offerTitle = offerMeta?.title || '';

  // 1) Message au client (best-effort).
  const clientChat = toWhatsappChatId(order.client_phone);
  if (clientChat) {
    try {
      await sendWhapiText(
        `🧾 *Commande ${num}* — ${COUNTRY.senderName}\n` +
          `Bonjour ${order.client_name || ''}, votre commande est *réservée*.\n\n` +
          `💵 Montant : *${totalStr}*\n` +
          `À régler en *espèces* à l'${COUNTRY.agency.name} la plus proche, *sous 48h*.\n\n` +
          `🔗 Récapitulatif : ${recapUrl}\n\n` +
          `Présentez votre numéro de commande *${num}* en agence. À bientôt !`,
        clientChat,
      );
    } catch {
      // ignore
    }
  }

  // 2) Notification groupe Staff (best-effort — nécessite WHAPI_STAFF_GROUP_ID).
  const staff = process.env.WHAPI_STAFF_GROUP_ID;
  if (staff) {
    try {
      await sendWhapiText(
        `🛒 *Nouvelle commande CASH* — ${num}\n` +
          `Client : ${order.client_name || '—'} (${order.client_phone || '—'})\n` +
          `Montant : ${totalStr}\n` +
          (offerTitle ? `Offre : ${offerTitle}\n` : '') +
          `À encaisser en agence (48h).\n` +
          `🔗 ${recapUrl}`,
        staff,
      );
    } catch {
      // ignore
    }
  }

  // 3) Récap détaillé (produits + liens 1688) dans le groupe 🧾 Commandes Oh My Gab.
  await notifyOrdersGroup(orderId, publicOrigin(request));

  return NextResponse.json({ success: true, order_number: num });
}
