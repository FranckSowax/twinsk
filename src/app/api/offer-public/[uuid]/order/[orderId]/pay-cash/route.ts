import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiText } from '@/lib/whapi';
import { orderNumber, toWhatsappChatId } from '@/lib/order-number';

// POST: le client choisit de payer CASH en agence.
// - Réserve la commande (payment_method='cash', payment_status='submitted').
// - Envoie au client un message WHAPI : n° de commande + lien récap + « agence sous 48h ».
// - Notifie le groupe Staff WhatsApp (env WHAPI_STAFF_GROUP_ID) de la nouvelle commande.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  const { uuid, orderId } = await params;

  const { data: order, error } = await supabaseAdmin
    .from('offer_orders')
    .update({ payment_method: 'cash', payment_status: 'submitted' })
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .select('id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, offers(title)')
    .single();
  if (error || !order) {
    return NextResponse.json({ error: error?.message || 'Commande introuvable' }, { status: 500 });
  }

  const num = orderNumber(order.id);
  const total = Number(order.grand_total_fcfa ?? order.items_total_fcfa) || 0;
  const totalStr = `${Math.round(total).toLocaleString('fr-FR')} FCFA`;
  const recapUrl = `${request.nextUrl.origin}/offer/${uuid}/order/${orderId}`;
  const offerTitle = (order.offers as { title?: string } | null)?.title || '';

  // 1) Message au client (best-effort).
  const clientChat = toWhatsappChatId(order.client_phone);
  if (clientChat) {
    try {
      await sendWhapiText(
        `🧾 *Commande ${num}* — TWINSK\n` +
          `Bonjour ${order.client_name || ''}, votre commande est *réservée*.\n\n` +
          `💵 Montant : *${totalStr}*\n` +
          `À régler en *espèces* à l'agence TWINSK la plus proche, *sous 48h*.\n\n` +
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

  return NextResponse.json({ success: true, order_number: num });
}
