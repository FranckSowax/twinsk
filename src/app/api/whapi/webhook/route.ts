import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { handleWhatsappCart } from '@/lib/whapi-cart';
import { extractInboundImage, extractInboundText, isSalonCandidate, type InboundMessage } from '@/lib/salon';
import { createSalonRequest, readSalonConfig, sendSalonAck } from '@/lib/salon-data';

// Webhook WHAPI (appelé par les serveurs WHAPI). PUBLIC mais protégé par un secret
// passé en query (?secret=WHAPI_WEBHOOK_SECRET). Capte les votes de sondage (poll_update).

interface PollResult { name?: string; count?: number; voters?: string[]; id?: string }
interface WhapiMessage {
  id?: string;
  type?: string;
  chat_id?: string;
  from?: string;
  from_me?: boolean;
  poll?: { title?: string; results?: PollResult[] };
  order?: { id?: string; token?: string; item_count?: number };
}

export async function POST(request: NextRequest) {
  const secret = process.env.WHAPI_WEBHOOK_SECRET;
  // Si un secret est configuré, il DOIT correspondre. Sinon on rejette (pas de webhook non protégé).
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { messages?: WhapiMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];

  // Groupe « Oh My Recherche » : chaque message client devient une demande
  // numérotée, avec accusé de réception dans le groupe (config lue une fois par lot).
  const salon = messages.length ? await readSalonConfig() : null;

  for (const m of messages) {
    if (salon?.enabled && isSalonCandidate(m as InboundMessage, salon.group_id) && m.id) {
      const im = m as InboundMessage;
      const phone = String(im.from || '').replace(/\D/g, '');
      if (phone) {
        const created = await createSalonRequest({
          msgId: m.id,
          chatId: salon.group_id,
          phone,
          name: im.from_name || null,
          text: extractInboundText(im),
          imageUrl: extractInboundImage(im),
        });
        if (created?.created && salon.ack_enabled) await sendSalonAck(salon.group_id, created.number, phone);
      }
      continue;
    }

    // Panier envoyé par un client depuis le catalogue WhatsApp → commande + lien de paiement.
    if (m.type === 'order' && m.order?.id && !m.from_me) {
      const chat = m.chat_id || (m.from ? `${m.from}@s.whatsapp.net` : '');
      if (chat) {
        await handleWhatsappCart({
          orderId: m.order.id,
          orderToken: m.order.token,
          customerChatId: chat,
          origin: request.nextUrl.origin,
        });
      }
      continue;
    }

    if (m.type !== 'poll_update' || !m.id || !m.poll) continue;
    const results = Array.isArray(m.poll.results) ? m.poll.results : [];
    const totalVotes = results.reduce((s, r) => s + (Number(r.count) || 0), 0);
    await supabaseAdmin.from('whapi_polls').upsert(
      {
        id: m.id,
        chat_id: m.chat_id ?? null,
        title: m.poll.title ?? null,
        results,
        total_votes: totalVotes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  }

  // Toujours répondre 200 rapidement pour éviter les retries WHAPI.
  return NextResponse.json({ ok: true });
}
