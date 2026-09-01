// Notification WhatsApp du groupe « 🧾 Commandes Oh My Gab » à chaque commande
// terminée (paiement choisi, ou demande de devis avec coordonnées).
// Le message donne les détails client + lignes avec le lien 1688 de chaque produit.

import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiText } from '@/lib/whapi';
import { orderNumber } from '@/lib/order-number';

export const ORDERS_GROUP_ID =
  process.env.WHAPI_ORDERS_GROUP_ID || '120363428402268041@g.us';

const PAYMENT_LABEL: Record<string, string> = {
  cash: '💵 Cash en agence (48h)',
  airtel: '📱 Airtel Money (capture soumise)',
  ebilling: '💳 eBilling',
};

const TRANSPORT_LABEL: Record<string, string> = {
  air: '✈️ Aérien',
  sea: '🚢 Maritime',
  quote: '📋 Sur devis',
};

interface OrderLineRow {
  product_title: string | null;
  variant_name: string | null;
  quantity: number | null;
  unit_price_cny: number | null;
  product_url: string | null;
}

interface OrderRow {
  id: string;
  offer_id: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  transport_mode: string | null;
  payment_method: string | null;
  grand_total_fcfa: number | null;
  items_total_fcfa: number | null;
  has_battery: boolean | null;
  offers: { title?: string } | null;
  offer_order_lines: OrderLineRow[] | null;
}

/** Envoie le récap d'une commande terminée dans le groupe Commandes (best-effort). */
export async function notifyOrdersGroup(orderId: string, origin: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from('offer_orders')
      .select(
        'id, offer_id, client_name, client_phone, client_email, transport_mode, ' +
          'payment_method, grand_total_fcfa, items_total_fcfa, has_battery, ' +
          'offers(title), offer_order_lines(product_title, variant_name, quantity, unit_price_cny, product_url)',
      )
      .eq('id', orderId)
      .single();
    const order = data as unknown as OrderRow | null;
    if (!order) return;

    const num = orderNumber(order.id);
    const offerTitle = order.offers?.title || '';
    const lines = (order.offer_order_lines || []) as OrderLineRow[];
    const total = Number(order.grand_total_fcfa ?? order.items_total_fcfa) || 0;

    const productLines = lines
      .map((l, i) => {
        const qty = Math.max(1, Math.trunc(Number(l.quantity) || 1));
        const variant = l.variant_name ? ` — ${l.variant_name}` : '';
        const link = l.product_url ? `\n   🔗 ${l.product_url}` : '';
        return `${i + 1}. ${l.product_title || 'Produit'} ×${qty}${variant}${link}`;
      })
      .join('\n');

    const payment = order.payment_method ? PAYMENT_LABEL[order.payment_method] : null;
    const transport = order.transport_mode ? TRANSPORT_LABEL[order.transport_mode] : null;

    const body =
      `🧾 *NOUVELLE COMMANDE ${num}*\n` +
      `👤 ${order.client_name || '—'} · 📞 ${order.client_phone || '—'}` +
      (order.client_email ? ` · ✉️ ${order.client_email}` : '') +
      `\n` +
      (offerTitle ? `🛍️ Listing : ${offerTitle}\n` : '') +
      `\n📦 *Produits (${lines.length})*\n${productLines}\n\n` +
      (total > 0 ? `💰 Total : *${Math.round(total).toLocaleString('fr-FR')} FCFA*\n` : '') +
      (transport ? `🚚 Transport : ${transport}\n` : '') +
      (payment ? `💳 Paiement : ${payment}\n` : '') +
      (order.has_battery ? `🔋 Contient des batteries\n` : '') +
      `\n🔗 Récap : ${origin}/offer/${order.offer_id}/order/${order.id}`;

    await sendWhapiText(body, ORDERS_GROUP_ID);
  } catch {
    // best-effort — ne bloque jamais la commande
  }
}
