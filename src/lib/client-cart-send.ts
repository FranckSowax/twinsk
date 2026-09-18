// Envoi (ou renvoi) d'un panier client sur le WhatsApp du client : accueil,
// une carte par produit (bouton « Voir le produit »), puis le récap chiffré
// avec le bouton « Voir mon panier ». Partagé par la création et le renvoi.

import { supabaseAdmin } from '@/lib/supabase/server';
import { CNY_TO_EUR, CNY_TO_FCFA, computeOrderPricing, formatSettlement, grandTotalFor, roundSettlement, transportCostFor } from '@/lib/offer-pricing';
import { readOrderSplit } from '@/lib/order-split';
import { loadOrderPricingLines, offerSettlementCurrency } from '@/lib/order-pricing-lines';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import { listingTagline, productDeepLink } from '@/lib/wa-drip';
import { sendWhapiButtonLink, sendWhapiImage, sendWhapiProductCard, sendWhapiText } from '@/lib/whapi';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ClientCartSendResult {
  order_id: string;
  order_url: string;
  client_name: string;
  client_phone: string;
  items_total_fcfa: number;
  air_total_fcfa: number | null;
  sea_total_fcfa: number | null;
  /** Transport retenu par l'admin (air | sea | mixed) et total à payer correspondant. */
  transport_mode: string | null;
  grand_total_fcfa: number | null;
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
    .select('id, offer_id, client_name, client_phone, transport_mode, promo_code, offers(title, theme)')
    .eq('id', args.orderId)
    .single();
  if (!order) return { error: 'Commande introuvable', status: 404 };
  const o = order as unknown as {
    id: string;
    offer_id: string;
    client_name: string | null;
    client_phone: string | null;
    transport_mode: string | null;
    promo_code: string | null;
    offers: { title?: string; theme?: string | null } | null;
  };
  const phone = (o.client_phone || '').replace(/\D/g, '');
  if (!o.client_name || phone.length < 8) return { error: 'Coordonnées du client incomplètes', status: 400 };

  const offerUrl = `${args.origin}/offer/${o.offer_id}`;
  const orderUrl = `${offerUrl}/order/${o.id}`;
  const [{ data: lineRows }, pricingLines, currency, split] = await Promise.all([
    supabaseAdmin
      .from('offer_order_lines')
      .select('id, product_id, product_title, variant_name, quantity, unit_price_cny, product_image, price_type')
      .eq('order_id', o.id),
    loadOrderPricingLines(o.id),
    offerSettlementCurrency(o.offer_id),
    readOrderSplit(o.id),
  ]);
  // Devise de règlement du listing (FCFA, ou euros pour un listing en euros).
  const pricing = computeOrderPricing(pricingLines, { currency });
  const lineRate = currency === 'EUR' ? CNY_TO_EUR : CNY_TO_FCFA;
  const fcfa = (n: number) => formatSettlement(n, currency);
  const lines = (lineRows || []) as {
    id: string;
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
    const unitFcfa = roundSettlement(l.unit_price_cny * lineRate, currency);
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

  // Transport retenu par l'admin (ou non) : le récap montre soit le choix et le
  // total à payer, soit les deux estimations.
  const mode = o.transport_mode === 'air' || o.transport_mode === 'sea' || o.transport_mode === 'mixed' ? o.transport_mode : null;
  const chosenCost = mode ? transportCostFor(pricing, mode) : null;
  const grandTotal = mode && chosenCost != null ? grandTotalFor(pricing, mode) : null;
  const isMixed = mode === 'mixed' && !!pricing.mixed;
  const recapLines = lines.map((l) => {
    const unitFcfa = roundSettlement(l.unit_price_cny * lineRate, currency);
    const t = (l.product_title || 'Produit').slice(0, 60);
    const air = isMixed ? Math.min(l.quantity, Math.max(0, split[l.id] ?? 0)) : null;
    const splitNote = air != null && l.quantity > 0 ? ` (✈️ ${air} · 🚢 ${l.quantity - air})` : '';
    return l.price_type === 'acompte'
      ? `• ${t} × ${l.quantity} — sur devis`
      : `• ${t}${l.variant_name ? ` (${l.variant_name})` : ''} × ${l.quantity}${splitNote} — ${fcfa(unitFcfa * l.quantity)}`;
  });
  let transportBlock = '';
  if (mode && chosenCost != null && grandTotal != null) {
    const label =
      mode === 'air'
        ? `✈️ Aérien (8 à 14 jours) : ${fcfa(chosenCost)}`
        : mode === 'sea'
          ? `🚢 Maritime (60 à 85 jours) : ${fcfa(chosenCost)}`
          : `✈️🚢 Fractionné : ✈️ ${pricing.mixed!.airUnits} unité(s) en avion ${fcfa(pricing.mixed!.airCost ?? 0)} · 🚢 ${pricing.mixed!.seaUnits} unité(s) en bateau ${fcfa(pricing.mixed!.seaCost ?? 0)} = ${fcfa(chosenCost)}`;
    transportBlock =
      `\n\n🚚 *Transport choisi*\n${label}` +
      (pricing.discountFcfa > 0 ? `\n🎁 Remise${o.promo_code ? ` ${o.promo_code}` : ''} : − ${fcfa(pricing.discountFcfa)}` : '') +
      `\n\n💰 *Total à payer : ${fcfa(grandTotal)}*` +
      `\n\nVous pouvez encore modifier votre panier ou le transport, puis payer (Airtel Money ou espèces).`;
  } else {
    const transport: string[] = [];
    if (pricing.airTotal != null) transport.push(`✈️ Aérien : ${fcfa(pricing.airTotal)} (8 à 14 jours)`);
    if (pricing.seaTotal != null) transport.push(`🚢 Maritime : ${fcfa(pricing.seaTotal)} (60 à 85 jours)`);
    transportBlock =
      (transport.length ? `\n\nEstimation avec transport :\n${transport.join('\n')}` : '') +
      `\n\nOuvrez votre panier pour choisir le transport, ajouter un code promo et payer (Airtel Money ou espèces).`;
  }
  const recap =
    `🧾 *Récapitulatif de votre panier*\n\n${recapLines.join('\n')}\n\n` +
    `*Total articles : ${fcfa(pricing.itemsTotalFcfaRounded)}*` +
    transportBlock;
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
    transport_mode: mode,
    grand_total_fcfa: grandTotal,
    sent,
    errors,
  };
}
