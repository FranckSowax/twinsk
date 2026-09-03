import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/offer-pricing';
import {
  MAX_PROMO_ATTEMPTS,
  computeItemsDiscount,
  countPromoUses,
  describePromo,
  evaluatePromo,
  findPromoByCode,
  normalizeCode,
  normalizePhone,
  releasePromoUse,
  reservePromoUse,
} from '@/lib/promo';
import { loadOrderPricingLines } from '@/lib/order-pricing-lines';

// POST   { code, client_phone? } → applique un code promo à la commande (réserve l'usage)
// DELETE                          → retire le code (libère l'usage)
// Les totaux (remise articles, tarif transport imposé) sont recalculés et persistés.

async function loadOrder(uuid: string, orderId: string) {
  const { data } = await supabaseAdmin
    .from('offer_orders')
    .select('*')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  return data;
}

/** Recalcule et persiste items/transport/total selon la promo portée par la commande. */
async function persistTotals(orderId: string, promo: { kind: string | null; rate: number | null; discount: number }, transportMode: string | null) {
  const lines = await loadOrderPricingLines(orderId);
  const pricing = computeOrderPricing(lines, {
    airRate: promo.kind === 'air_rate' ? promo.rate : null,
    seaRate: promo.kind === 'sea_rate' ? promo.rate : null,
    discountFcfa: promo.discount,
  });
  const transportCost = transportMode === 'air' ? pricing.airCost : transportMode === 'sea' ? pricing.seaCost : null;
  const grandTotal =
    transportMode === 'air' ? pricing.airTotal : transportMode === 'sea' ? pricing.seaTotal : pricing.itemsNetFcfa;
  await supabaseAdmin
    .from('offer_orders')
    .update({
      items_total_fcfa: pricing.itemsTotalFcfaRounded,
      transport_cost: transportCost,
      grand_total_fcfa: grandTotal ?? pricing.itemsNetFcfa,
    })
    .eq('id', orderId);
  return pricing;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  const { uuid, orderId } = await params;
  const order = await loadOrder(uuid, orderId);
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { code?: string; client_phone?: string };
  const code = normalizeCode(body.code);
  if (!code) return NextResponse.json({ error: 'Saisissez un code promo.' }, { status: 400 });

  // Anti brute-force : plafond de tentatives par commande.
  if ((order.promo_attempts || 0) >= MAX_PROMO_ATTEMPTS) {
    return NextResponse.json({ error: 'Trop de tentatives. Contactez-nous sur WhatsApp.' }, { status: 429 });
  }
  const fail = async (message: string, status = 400) => {
    await supabaseAdmin
      .from('offer_orders')
      .update({ promo_attempts: (order.promo_attempts || 0) + 1 })
      .eq('id', orderId);
    return NextResponse.json({ error: message }, { status });
  };

  const promo = await findPromoByCode(code);
  if (!promo) return fail('Code promo inconnu.');

  const phone = normalizePhone(body.client_phone || order.client_phone) || null;
  const lines = await loadOrderPricingLines(orderId);
  const base = computeOrderPricing(lines);
  const uses = await countPromoUses(promo.id, phone, orderId);
  const verdict = evaluatePromo(promo, {
    now: new Date(),
    phone,
    itemsTotalFcfa: base.itemsTotalFcfaRounded,
    totalUses: uses.total,
    phoneUses: uses.byPhone,
  });
  if (!verdict.ok) return fail(verdict.reason);

  // Un code transport n'a d'effet que sur le mode correspondant : on prévient,
  // sans bloquer (le client peut encore changer de transport).
  let notice: string | null = null;
  if (promo.kind === 'air_rate' && order.transport_mode === 'sea') notice = 'Ce code s’applique au fret aérien.';
  if (promo.kind === 'sea_rate' && order.transport_mode === 'air') notice = 'Ce code s’applique au fret maritime.';

  const discount = computeItemsDiscount(promo, base.itemsTotalFcfaRounded);
  const rate = promo.kind === 'air_rate' || promo.kind === 'sea_rate' ? promo.value : null;

  // Une seule promo par commande : l'ancienne est libérée.
  if (order.promo_id && order.promo_id !== promo.id) await releasePromoUse(orderId);
  await reservePromoUse({ promoId: promo.id, orderId, phone, discountFcfa: discount });
  await supabaseAdmin
    .from('offer_orders')
    .update({
      promo_id: promo.id,
      promo_code: promo.code,
      promo_kind: promo.kind,
      promo_rate: rate,
      promo_discount_fcfa: discount,
      ...(phone && !order.client_phone ? { client_phone: body.client_phone?.trim() || null } : {}),
    })
    .eq('id', orderId);
  const pricing = await persistTotals(orderId, { kind: promo.kind, rate, discount }, order.transport_mode);

  return NextResponse.json({
    success: true,
    promo: { code: promo.code, kind: promo.kind, value: promo.value, label: describePromo(promo), discount_fcfa: discount, rate },
    notice,
    pricing,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  const { uuid, orderId } = await params;
  const order = await loadOrder(uuid, orderId);
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  if (order.promo_id) await releasePromoUse(orderId);
  await supabaseAdmin
    .from('offer_orders')
    .update({ promo_id: null, promo_code: null, promo_kind: null, promo_rate: null, promo_discount_fcfa: 0 })
    .eq('id', orderId);
  const pricing = await persistTotals(orderId, { kind: null, rate: null, discount: 0 }, order.transport_mode);
  return NextResponse.json({ success: true, pricing });
}
