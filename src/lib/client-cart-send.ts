// Envoi (ou renvoi) d'un panier client sur le WhatsApp du client : accueil,
// une carte par produit (bouton « Voir le produit »), puis le récap chiffré
// avec le bouton « Voir mon panier ». Partagé par la création et le renvoi.

import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing, CNY_TO_FCFA } from '@/lib/offer-pricing';
import { loadOrderPricingLines } from '@/lib/order-pricing-lines';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import { roundXafUp } from '@/lib/utils/formatCurrency';
import { listingTagline, productDeepLink } from '@/lib/wa-drip';
import { sendWhapiButtonLink, sendWhapiImage, sendWhapiProductCard, sendWhapiText } from '@/lib/whapi';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export interface ClientCartSendResult {
  order_id: string;
  order_url: string;
  client_name: string;
  client_phone: string;
  items_total_fcfa: number;
  air_total_fcfa: number | null;
  sea_total_fcfa: number | null;
  sent: number;
  errors: string[];
}

export async function sendClientCartWhatsapp(args: {
  orderId: string;
  origin: string;
  message?: string;
  actor?: string;
}): Promise<ClientCartSendResult | { error: string; status: number }> {
  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('id, offer_id, client_name, client_phone, offers(title, theme)')
    .eq('id', args.orderId)
    .single();
  if (!order) return { error: 'Commande introuvable', status: 404 };
  const o = order as unknown as {
    id: string;
    offer_id: string;
    client_name: string | null;
    client_phone: string | null;
    offers: { title?: string; theme?: string | null } | null;
  };
  const phone = (o.client_phone || '').replace(/\D/g, '');
  if (!o.client_name || phone.length < 8) return { error: 'Coordonnées du client incomplètes', status: 400 };

  const offerUrl = `${args.origin}/offer/${o.offer_id}`;
  const orderUrl = `${offerUrl}/order/${o.id}`;
  const [{ data: lineRows }, pricingLines] = await Promise.all([
    supabaseAdmin
      .from('offer_order_lines')
      .select('product_id, product_title, variant_name, quantity, unit_price_cny, product_image, price_type')
      .eq('order_id', o.id),
    loadOrderPricingLines(o.id),
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
  if (!lines.length) return { error: 'Panier vide', status: 400 };
  const tagline = listingTagline({ title: o.offers?.title || 'Listing', theme: o.offers?.theme ?? null });
  const publicImage = (url: string) => {
    const p = proxyImageUrl(url);
    return p.startsWith('/') ? `${args.origin}${p}` : p;
  };
  const to = `${phone}@s.whatsapp.net`;
  const errors: string[] = [];
  let sent = 0;

  const intro =
    `Bonjour ${o.client_name} 👋\n\n` +
    `Voici la sélection préparée pour vous par *Oh My Gab*\n🛍️ ${tagline}\n\n` +
    (args.message?.trim() ? `${args.message.trim()}\n\n` : '') +
    `Les fiches produits suivent, puis le récapitulatif de votre panier.`;
  const hello = await sendWhapiText(intro, to);
  if (hello.ok) sent += 1;
  else errors.push(`intro : ${hello.error}`);
  await sleep(1200);

  for (const l of lines) {
    const title = (l.product_title || 'Produit').slice(0, 120);
    const acompte = l.price_type === 'acompte';
    const unitFcfa = roundXafUp(l.unit_price_cny * CNY_TO_FCFA);
    const priceLine = acompte ? 'Sur devis (acompte usine)' : `${l.quantity} × ${fcfa(unitFcfa)} = *${fcfa(unitFcfa * l.quantity)}*`;
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

  const recapLines = lines.map((l) => {
    const unitFcfa = roundXafUp(l.unit_price_cny * CNY_TO_FCFA);
    const t = (l.product_title || 'Produit').slice(0, 60);
    return l.price_type === 'acompte'
      ? `• ${t} × ${l.quantity} — sur devis`
      : `• ${t}${l.variant_name ? ` (${l.variant_name})` : ''} × ${l.quantity} — ${fcfa(unitFcfa * l.quantity)}`;
  });
  const transport: string[] = [];
  if (pricing.airTotal != null) transport.push(`✈️ Aérien : ${fcfa(pricing.airTotal)} (8 à 14 jours)`);
  if (pricing.seaTotal != null) transport.push(`🚢 Maritime : ${fcfa(pricing.seaTotal)} (60 à 85 jours)`);
  const recap =
    `🧾 *Récapitulatif de votre panier*\n\n${recapLines.join('\n')}\n\n` +
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
    note: `${o.client_name} (${phone}) · ${lines.length} article(s) · ${fcfa(pricing.itemsTotalFcfaRounded)} · ${sent} envoi(s)${errors.length ? ` · ${errors.length} err.` : ''}`,
    done_by: args.actor || 'admin',
  });

  return {
    order_id: o.id,
    order_url: orderUrl,
    client_name: o.client_name,
    client_phone: phone,
    items_total_fcfa: pricing.itemsTotalFcfaRounded,
    air_total_fcfa: pricing.airTotal,
    sea_total_fcfa: pricing.seaTotal,
    sent,
    errors,
  };
}
