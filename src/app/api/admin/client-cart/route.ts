import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { validateContact } from '@/lib/contact-validation';
import { createOfferOrder, type OrderPick } from '@/lib/offer-order-create';
import { publicOrigin } from '@/lib/public-origin';
import { sendClientCartWhatsapp } from '@/lib/client-cart-send';
import { applyOrderTransport, parseTransportMode } from '@/lib/order-transport';
import { settlementCurrencyOf } from '@/lib/offer-pricing';

// « Panier client » (admin).
// GET  → paniers enregistrés (commandes non payées, les plus récentes) pour édition.
// POST → crée la commande au nom du client ; `send: false` = sauvegarder sans
//        envoyer (brouillon éditable), sinon envoi WhatsApp immédiat.
// Body: { offer_id, client_name, client_phone, picks: [{product_id, variant_id?, quantity}], message?, send? }

export const maxDuration = 180;

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('offer_orders')
    .select('id, offer_id, client_name, client_phone, status, payment_status, transport_mode, items_total_fcfa, grand_total_fcfa, created_at, offers(title, offer_currency), offer_order_lines(quantity)')
    .neq('client_name', '')
    .neq('client_phone', '')
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const carts = (data || []).map((o) => {
    const lines = (o.offer_order_lines || []) as { quantity: number | null }[];
    const row = o as unknown as { offers?: { title?: string; offer_currency?: string | null } | null };
    return {
      id: o.id,
      offer_id: o.offer_id,
      offer_title: row.offers?.title || null,
      currency: settlementCurrencyOf(row.offers?.offer_currency),
      client_name: o.client_name,
      client_phone: o.client_phone,
      status: o.status,
      transport_mode: o.transport_mode,
      items_total_fcfa: o.items_total_fcfa,
      grand_total_fcfa: o.grand_total_fcfa,
      items_count: lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0),
      created_at: o.created_at,
    };
  });
  return NextResponse.json({ carts });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    offer_id?: string;
    client_name?: string;
    client_phone?: string;
    picks?: (OrderPick & { air_qty?: number | null })[];
    message?: string;
    send?: boolean;
    /** Transport choisi par l'admin dès la composition (air | sea | mixed). */
    transport_mode?: unknown;
  };
  if (!body.offer_id) return NextResponse.json({ error: 'Listing requis' }, { status: 400 });
  const contact = validateContact(body.client_name, body.client_phone);
  if (!contact.ok) return NextResponse.json({ error: contact.error }, { status: 400 });

  const created = await createOfferOrder({
    offerId: body.offer_id,
    clientName: contact.name,
    clientPhone: contact.phone,
    picks: Array.isArray(body.picks) ? body.picks : [],
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });

  // Transport choisi avant la sauvegarde : appliqué à la commande créée. En mode
  // fractionné, la répartition (air_qty par pick) est reportée sur les lignes.
  const mode = parseTransportMode(body.transport_mode);
  let transportWarning: string | null = null;
  if (mode && mode !== 'quote') {
    let split: Record<string, number> | undefined;
    if (mode === 'mixed') {
      const { data: lineRows } = await supabaseAdmin
        .from('offer_order_lines')
        .select('id, product_id, variant_id')
        .eq('order_id', created.orderId);
      split = {};
      for (const l of (lineRows || []) as { id: string; product_id: string | null; variant_id: string | null }[]) {
        const pick = (body.picks || []).find((p) => p.product_id === l.product_id && (p.variant_id || null) === (l.variant_id || null));
        split[l.id] = Math.max(0, Math.trunc(Number(pick?.air_qty)) || 0);
      }
    }
    const t = await applyOrderTransport({ orderId: created.orderId, offerId: body.offer_id, mode, split });
    if (!t.ok) transportWarning = t.error;
  }

  const origin = publicOrigin(request);
  const orderUrl = `${origin}/offer/${body.offer_id}/order/${created.orderId}`;
  if (body.send === false) {
    return NextResponse.json({ success: true, saved: true, order_id: created.orderId, order_url: orderUrl, sent: 0, errors: transportWarning ? [transportWarning] : [] });
  }
  const r = await sendClientCartWhatsapp({ orderId: created.orderId, origin, message: body.message });
  if ('error' in r) return NextResponse.json({ error: r.error, order_id: created.orderId, order_url: orderUrl }, { status: r.status });
  const errors = transportWarning ? [transportWarning, ...r.errors] : r.errors;
  return NextResponse.json({ success: errors.length === 0, saved: true, ...r, errors });
}
