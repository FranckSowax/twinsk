import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { mirrorOrderToRequest } from '@/lib/offer-order-mirror';

// PATCH: le client renseigne ses coordonnées (après le choix du transport,
// avant le paiement). Enregistre nom/téléphone/email sur la commande, puis crée
// le miroir /admin/requests (si pas déjà fait). Idempotent.
// Body: { client_name, client_phone, client_email? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  const { uuid, orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    client_name?: string;
    client_phone?: string;
    client_email?: string;
  };
  const clientName = (body.client_name || '').trim();
  const clientPhone = (body.client_phone || '').trim();
  const clientEmail = (body.client_email || '').trim();

  if (!clientName) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  }
  if (!clientPhone) {
    return NextResponse.json({ error: 'Numéro WhatsApp requis' }, { status: 400 });
  }

  // Vérifie que la commande existe et appartient à l'offre.
  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('id, offer_id, request_id')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  // 1. Met à jour les coordonnées sur la commande.
  const { error: updErr } = await supabaseAdmin
    .from('offer_orders')
    .update({
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail || null,
    })
    .eq('id', orderId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // 2. Miroir /admin/requests (ou mise à jour si déjà créé).
  if (order.request_id) {
    await supabaseAdmin
      .from('requests')
      .update({
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail || null,
      })
      .eq('id', order.request_id);
  } else {
    const { data: offer } = await supabaseAdmin
      .from('offers')
      .select('title')
      .eq('id', uuid)
      .single();
    await mirrorOrderToRequest({
      orderId,
      offerTitle: offer?.title || 'Offre',
      clientName,
      clientPhone,
      clientEmail,
    });
  }

  return NextResponse.json({ success: true });
}
