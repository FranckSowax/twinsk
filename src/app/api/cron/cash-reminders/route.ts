import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiText } from '@/lib/whapi';
import { orderNumber, toWhatsappChatId } from '@/lib/order-number';

// GET/POST: relance des commandes CASH non réglées après ~36h (à appeler par un
// cron externe/Railway toutes les 10-30 min). Sécurisé par CRON_SECRET.
// Envoie au client une relance avec facilitation Airtel Money, puis marque relancé.
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key');
  if (!secret || key !== secret) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const now = Date.now();
  const since36h = new Date(now - 36 * 3600 * 1000).toISOString();
  const since72h = new Date(now - 72 * 3600 * 1000).toISOString(); // borne (n'insiste pas indéfiniment)

  const { data: orders } = await supabaseAdmin
    .from('offer_orders')
    .select('id, offer_id, client_name, client_phone, grand_total_fcfa, items_total_fcfa')
    .eq('payment_method', 'cash')
    .neq('payment_status', 'paid')
    .is('cash_reminded_at', null)
    .lte('created_at', since36h)
    .gte('created_at', since72h)
    .limit(100);

  const airtel = process.env.AIRTEL_MONEY_NUMBER || null;
  let sent = 0;

  for (const o of orders || []) {
    const num = orderNumber(o.id);
    const total = Number(o.grand_total_fcfa ?? o.items_total_fcfa) || 0;
    const totalStr = `${Math.round(total).toLocaleString('fr-FR')} FCFA`;
    const recapUrl = `${request.nextUrl.origin}/offer/${o.offer_id}/order/${o.id}`;
    const chat = toWhatsappChatId(o.client_phone);

    if (chat) {
      try {
        await sendWhapiText(
          `⏰ *Rappel — Commande ${num}*\n` +
            `Bonjour ${o.client_name || ''}, votre commande de *${totalStr}* vous attend.\n` +
            `Il vous reste peu de temps pour régler en *espèces à l'agence* (48h).\n\n` +
            `💡 Plus rapide : payez par *Airtel Money*` +
            (airtel ? ` au *${airtel}*` : '') +
            ` puis validez ici :\n${recapUrl}`,
          chat,
        );
        sent++;
      } catch {
        // ignore
      }
    }

    await supabaseAdmin
      .from('offer_orders')
      .update({ cash_reminded_at: new Date(now).toISOString() })
      .eq('id', o.id);
  }

  return NextResponse.json({ success: true, candidates: orders?.length || 0, sent });
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
