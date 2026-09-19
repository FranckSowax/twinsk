// Confirmation WhatsApp au CLIENT à chaque changement de statut de sa commande
// (payée, expédiée, arrivée à l'agence, remise). Source unique des messages :
// utilisée par l'admin (/admin/commandes) et par l'espace agent.
// Best-effort : un envoi raté ne bloque jamais le changement de statut, mais
// il est journalisé (playbook_log, rituel `order_status_notify`).

import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiText } from '@/lib/whapi';
import { orderNumber, toWhatsappChatId } from '@/lib/order-number';
import { formatSettlement, settlementCurrencyOf, type SettlementCurrency } from '@/lib/offer-pricing';

export type NotifiableStatus = 'paid' | 'shipped' | 'at_agency' | 'delivered';
export const NOTIFIABLE_STATUSES: NotifiableStatus[] = ['paid', 'shipped', 'at_agency', 'delivered'];

export function isNotifiableStatus(v: unknown): v is NotifiableStatus {
  return typeof v === 'string' && (NOTIFIABLE_STATUSES as string[]).includes(v);
}

export interface StatusMessageInput {
  status: NotifiableStatus;
  orderId: string;
  clientName?: string | null;
  total?: number | null;
  currency?: SettlementCurrency;
  transportMode?: string | null;
  /** Lien vers le récapitulatif de la commande. */
  recapUrl?: string | null;
}

const DELAY: Record<string, string> = {
  air: '8 à 14 jours (fret aérien)',
  sea: '60 à 85 jours (fret maritime)',
  mixed: '8 à 14 jours pour la partie avion, 60 à 85 jours pour la partie bateau',
};

/** Message envoyé au client pour un statut donné (pur, testé). */
export function buildStatusMessage(i: StatusMessageInput): string {
  const num = orderNumber(i.orderId);
  const hello = i.clientName?.trim() ? `Bonjour ${i.clientName.trim()}, ` : 'Bonjour, ';
  const total = i.total != null && i.total > 0 ? formatSettlement(i.total, i.currency || 'XAF') : null;
  const recap = i.recapUrl ? `\n\n🔗 Suivi de votre commande : ${i.recapUrl}` : '';
  switch (i.status) {
    case 'paid':
      return (
        `✅ *Paiement confirmé* — Commande ${num}\n\n` +
        `${hello}nous avons bien reçu votre paiement${total ? ` de *${total}*` : ''}. Votre commande est validée et part en préparation.` +
        (i.transportMode && DELAY[i.transportMode] ? `\n\n🚚 Délai estimé : ${DELAY[i.transportMode]}.` : '') +
        `\nNous vous prévenons ici à chaque étape.` +
        recap
      );
    case 'shipped':
      return (
        `📦 *Commande expédiée* — ${num}\n\n` +
        `${hello}votre commande a quitté notre entrepôt en Chine.` +
        (i.transportMode && DELAY[i.transportMode] ? `\n\n🚚 Délai estimé : ${DELAY[i.transportMode]}.` : '') +
        `\nNous vous écrivons dès son arrivée à l'agence.` +
        recap
      );
    case 'at_agency':
      return (
        `🎉 *Votre colis est arrivé* — Commande ${num}\n\n` +
        `${hello}votre commande est disponible à l'agence TWINSK. Présentez le numéro *${num}* pour la retirer.` +
        recap
      );
    case 'delivered':
      return (
        `🤝 *Commande remise* — ${num}\n\n` +
        `${hello}votre commande vous a été remise. Merci de votre confiance ! Un souci ou une question ? Répondez simplement à ce message.`
      );
  }
}

/** Charge la commande et envoie la confirmation du statut au client. */
export async function notifyClientOrderStatus(args: {
  orderId: string;
  status: NotifiableStatus;
  origin: string;
  actor?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { data } = await supabaseAdmin
      .from('offer_orders')
      .select('id, offer_id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, transport_mode, offers(offer_currency)')
      .eq('id', args.orderId)
      .single();
    const o = data as unknown as {
      id: string;
      offer_id: string;
      client_name: string | null;
      client_phone: string | null;
      grand_total_fcfa: number | null;
      items_total_fcfa: number | null;
      transport_mode: string | null;
      offers: { offer_currency?: string | null } | null;
    } | null;
    if (!o) return { sent: false, reason: 'commande introuvable' };
    const chat = toWhatsappChatId(o.client_phone);
    if (!chat) return { sent: false, reason: 'numéro WhatsApp du client manquant ou invalide' };

    const body = buildStatusMessage({
      status: args.status,
      orderId: o.id,
      clientName: o.client_name,
      total: Number(o.grand_total_fcfa ?? o.items_total_fcfa) || null,
      currency: settlementCurrencyOf(o.offers?.offer_currency),
      transportMode: o.transport_mode,
      recapUrl: `${args.origin}/offer/${o.offer_id}/order/${o.id}`,
    });
    let r = await sendWhapiText(body, chat);
    if (!r.ok) {
      await new Promise((res) => setTimeout(res, 1500));
      r = await sendWhapiText(body, chat);
    }
    await supabaseAdmin.from('playbook_log').insert({
      ritual: 'order_status_notify',
      note: `${orderNumber(o.id)} · ${args.status} · ${o.client_name || '—'} · ${r.ok ? 'client prévenu sur WhatsApp' : `ÉCHEC : ${r.error}`}`,
      done_by: args.actor || 'admin',
    });
    if (!r.ok) console.error(`[order-status-notify] ${orderNumber(o.id)} ${args.status} : ${r.error}`);
    return r.ok ? { sent: true } : { sent: false, reason: r.error || 'envoi refusé' };
  } catch (e) {
    console.error('[order-status-notify] exception', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'erreur interne' };
  }
}
