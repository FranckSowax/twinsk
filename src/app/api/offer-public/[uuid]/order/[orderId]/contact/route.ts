import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { mirrorOrderToRequest } from '@/lib/offer-order-mirror';
import { sendWhapiText } from '@/lib/whapi';
import { notifyOrdersGroup } from '@/lib/order-notify';
import { validateContact } from '@/lib/contact-validation';

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
  const contact = validateContact(body.client_name, body.client_phone);
  if (!contact.ok) {
    return NextResponse.json({ error: contact.error }, { status: 400 });
  }
  const clientName = contact.name;
  const clientPhone = contact.phone;
  const clientEmail = (body.client_email || '').trim();

  // Vérifie que la commande existe et appartient à l'offre.
  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('*')
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

  // Notification à l'affilié (marque blanche) : nouvelle vente sur sa boutique.
  const affiliateId = (order as { affiliate_id?: string | null }).affiliate_id;
  if (affiliateId) {
    try {
      const { data: aff } = await supabaseAdmin
        .from('affiliates')
        .select('shop_name, whatsapp_number')
        .eq('id', affiliateId)
        .single();
      if (aff?.whatsapp_number) {
        const total = Number(
          (order as { grand_total_fcfa?: number | null; items_total_fcfa?: number | null }).grand_total_fcfa ??
            (order as { items_total_fcfa?: number | null }).items_total_fcfa,
        );
        const commission = Number((order as { commission_fcfa?: number | null }).commission_fcfa) || 0;
        const linkId = (order as { affiliate_offer_id?: string | null }).affiliate_offer_id;
        await sendWhapiText(
          `🛒 Nouvelle commande — Boutique « ${aff.shop_name || 'Partenaire'} »\n` +
            `Client : ${clientName} (${clientPhone})\n` +
            (Number.isFinite(total) && total > 0 ? `Total : ${Math.round(total).toLocaleString('fr-FR')} FCFA\n` : '') +
            (commission > 0 ? `Votre commission : ${Math.round(commission).toLocaleString('fr-FR')} FCFA\n` : '') +
            (linkId ? `👉 ${request.nextUrl.origin}/partenaire/${linkId}` : ''),
          `${aff.whatsapp_number.replace(/\D/g, '')}@s.whatsapp.net`,
        );
      }
    } catch {
      // best-effort — ne bloque jamais la commande
    }
  }

  // Demandes de devis (pas d'étape paiement) : la commande est « terminée » dès
  // les coordonnées enregistrées → récap dans le groupe 🧾 Commandes Oh My Gab.
  // Seulement à la 1ʳᵉ saisie (pas de doublon si le client corrige ses infos).
  const total = Number(
    (order as { grand_total_fcfa?: number | null; items_total_fcfa?: number | null }).grand_total_fcfa ??
      (order as { items_total_fcfa?: number | null }).items_total_fcfa,
  );
  const isQuote =
    (order as { transport_mode?: string | null }).transport_mode === 'quote' ||
    !(Number.isFinite(total) && total > 0);
  const firstContact = !(order.client_name && order.client_phone);
  if (isQuote && firstContact) {
    await notifyOrdersGroup(orderId, request.nextUrl.origin);
  }

  return NextResponse.json({ success: true });
}
