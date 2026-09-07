import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { validateContact } from '@/lib/contact-validation';
import { createOfferOrder, type OrderPick } from '@/lib/offer-order-create';
import { computeOrderPricing } from '@/lib/offer-pricing';
import { loadOrderPricingLines } from '@/lib/order-pricing-lines';
import { publicOrigin } from '@/lib/public-origin';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import { roundXafUp } from '@/lib/utils/formatCurrency';
import { CNY_TO_FCFA } from '@/lib/offer-pricing';
import { listingTagline, productDeepLink } from '@/lib/wa-drip';
import { sendWhapiButtonLink, sendWhapiImage, sendWhapiProductCard, sendWhapiText } from '@/lib/whapi';

// POST : « Panier client » — l'admin compose un panier pour un client, la
// commande est créée à son nom (mêmes règles que le panier public), puis
// envoyée sur SON WhatsApp : une carte par produit (bouton « Voir le produit »),
// puis le récap avec le bouton « Voir mon panier » (page commande : transport,
// code promo, paiement).
// Body: { offer_id, client_name, client_phone, picks: [{product_id, variant_id?, quantity}], message? }

export const maxDuration = 180;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    offer_id?: string;
    client_name?: string;
    client_phone?: string;
    picks?: OrderPick[];
    message?: string;
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

  const origin = publicOrigin(request);
  const offerUrl = `${origin}/offer/${body.offer_id}`;
  const orderUrl = `${offerUrl}/order/${created.orderId}`;

  // Récap chiffré (même moteur que la page commande : total articles arrondi,
  // estimations transport aérien / maritime quand poids et volume sont connus).
  const [{ data: offer }, { data: lineRows }, pricingLines] = await Promise.all([
    supabaseAdmin.from('offers').select('title, theme').eq('id', body.offer_id).single(),
    supabaseAdmin
      .from('offer_order_lines')
      .select('product_id, product_title, variant_name, quantity, unit_price_cny, product_image, price_type')
      .eq('order_id', created.orderId),
    loadOrderPricingLines(created.orderId),
  ]);
  const pricing = computeOrderPricing(pricingLines);
  const lines = (lineRows || []) as {
    product_id: string | null;
    product_title: string | null;
    variant_name: string | null;
    quantity: number;
    unit_price_cny: number;
    product_image: string | null;
    price_type: string | null;
  }[];
  const tagline = listingTagline({ title: offer?.title || created.offerTitle, theme: offer?.theme ?? null });
  const publicImage = (url: string) => {
    const p = proxyImageUrl(url);
    return p.startsWith('/') ? `${origin}${p}` : p;
  };

  const to = `${contact.phone}@s.whatsapp.net`;
  const errors: string[] = [];
  let sent = 0;

  // 1. Bonjour
  const intro =
    `Bonjour ${contact.name} 👋\n\n` +
    `Voici la sélection préparée pour vous par *Oh My Gab*\n🛍️ ${tagline}\n\n` +
    (body.message?.trim() ? `${body.message.trim()}\n\n` : '') +
    `Les fiches produits suivent, puis le récapitulatif de votre panier.`;
  const hello = await sendWhapiText(intro, to);
  if (hello.ok) sent += 1;
  else errors.push(`intro : ${hello.error}`);
  await sleep(1200);

  // 2. Une fiche par produit (carte à bouton, repli photo + légende)
  for (const l of lines) {
    const title = (l.product_title || 'Produit').slice(0, 120);
    const acompte = l.price_type === 'acompte';
    const unitFcfa = roundXafUp(l.unit_price_cny * CNY_TO_FCFA);
    const priceLine = acompte
      ? 'Sur devis (acompte usine)'
      : `${l.quantity} × ${fcfa(unitFcfa)} = *${fcfa(unitFcfa * l.quantity)}*`;
    const cardBody = [`*${title}*`, l.variant_name ? `Variante : ${l.variant_name}` : null, priceLine].filter(Boolean).join('\n\n');
    const url = l.product_id ? productDeepLink(offerUrl, l.product_id) : offerUrl;
    const img = l.product_image ? publicImage(l.product_image) : null;
    let r = img
      ? await sendWhapiProductCard({ imageUrl: img, body: cardBody, footer: tagline, buttonTitle: 'Voir le produit', url, to })
      : await sendWhapiButtonLink({ body: cardBody, buttonTitle: 'Voir le produit', url, to });
    if (!r.ok && img) {
      await sleep(800);
      r = await sendWhapiImage(img, `${cardBody}\n\n👉 ${url}`, to);
    }
    if (r.ok) sent += 1;
    else errors.push(`${title.slice(0, 40)} : ${r.error}`);
    await sleep(1200);
  }

  // 3. Récapitulatif + bouton vers le panier
  const recapLines = lines.map((l) => {
    const unitFcfa = roundXafUp(l.unit_price_cny * CNY_TO_FCFA);
    const q = l.quantity;
    return l.price_type === 'acompte'
      ? `• ${(l.product_title || 'Produit').slice(0, 60)} × ${q} — sur devis`
      : `• ${(l.product_title || 'Produit').slice(0, 60)}${l.variant_name ? ` (${l.variant_name})` : ''} × ${q} — ${fcfa(unitFcfa * q)}`;
  });
  const transport: string[] = [];
  if (pricing.airTotal != null) transport.push(`✈️ Aérien : ${fcfa(pricing.airTotal)} (8 à 14 jours)`);
  if (pricing.seaTotal != null) transport.push(`🚢 Maritime : ${fcfa(pricing.seaTotal)} (60 à 85 jours)`);
  const recap =
    `🧾 *Récapitulatif de votre panier*\n\n` +
    `${recapLines.join('\n')}\n\n` +
    `*Total articles : ${fcfa(pricing.itemsTotalFcfaRounded)}*` +
    (transport.length ? `\n\nEstimation avec transport :\n${transport.join('\n')}` : '') +
    `\n\nOuvrez votre panier pour choisir le transport, ajouter un code promo et payer (Airtel Money ou espèces).`;
  const tail = await sendWhapiButtonLink({ body: recap, buttonTitle: 'Voir mon panier', url: orderUrl, to });
  if (tail.ok) sent += 1;
  else {
    const t = await sendWhapiText(`${recap}\n\n👉 ${orderUrl}`, to);
    if (t.ok) sent += 1;
    else errors.push(`récap : ${t.error}`);
  }

  await supabaseAdmin.from('playbook_log').insert({
    ritual: 'client_cart',
    note: `${contact.name} (${contact.phone}) · ${lines.length} article(s) · ${fcfa(pricing.itemsTotalFcfaRounded)} · ${sent} envoi(s)${errors.length ? ` · ${errors.length} err.` : ''}`,
    done_by: 'admin',
  });

  return NextResponse.json({
    success: errors.length === 0,
    order_id: created.orderId,
    order_url: orderUrl,
    items_total_fcfa: pricing.itemsTotalFcfaRounded,
    air_total_fcfa: pricing.airTotal,
    sea_total_fcfa: pricing.seaTotal,
    sent,
    errors,
  });
}
