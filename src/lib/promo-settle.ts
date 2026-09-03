// Au moment de payer : le code promo porté par la commande est re-validé
// (fenêtre, quotas — sans compter la commande elle-même), puis confirmé.
// S'il n'est plus valable, il est retiré et les totaux recalculés, pour que le
// client ne paie jamais un montant remisé à tort.

import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/offer-pricing';
import { loadOrderPricingLines } from '@/lib/order-pricing-lines';
import { confirmPromoUse, countPromoUses, evaluatePromo, normalizePhone, releasePromoUse, type PromoCode } from '@/lib/promo';

export type SettleResult = { ok: true; applied: boolean } | { ok: false; reason: string };

export async function settlePromoForOrder(orderId: string): Promise<SettleResult> {
  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (!order || !order.promo_id) return { ok: true, applied: false };

  const { data: promo } = await supabaseAdmin.from('promo_codes').select('*').eq('id', order.promo_id).maybeSingle();
  const phone = normalizePhone(order.client_phone) || null;
  let reason: string | null = null;

  if (!promo) reason = 'Ce code promo n’existe plus.';
  else {
    const lines = await loadOrderPricingLines(orderId);
    const base = computeOrderPricing(lines);
    const uses = await countPromoUses(promo.id, phone, orderId);
    const verdict = evaluatePromo(promo as PromoCode, {
      now: new Date(),
      phone,
      itemsTotalFcfa: base.itemsTotalFcfaRounded,
      totalUses: uses.total,
      phoneUses: uses.byPhone,
    });
    if (!verdict.ok) reason = verdict.reason;
  }

  if (reason) {
    // Retrait : usage libéré, promo effacée, totaux recalculés sans elle.
    await releasePromoUse(orderId);
    const lines = await loadOrderPricingLines(orderId);
    const pricing = computeOrderPricing(lines);
    const mode = order.transport_mode;
    await supabaseAdmin
      .from('offer_orders')
      .update({
        promo_id: null,
        promo_code: null,
        promo_kind: null,
        promo_rate: null,
        promo_discount_fcfa: 0,
        items_total_fcfa: pricing.itemsTotalFcfaRounded,
        transport_cost: mode === 'air' ? pricing.airCost : mode === 'sea' ? pricing.seaCost : null,
        grand_total_fcfa: (mode === 'air' ? pricing.airTotal : mode === 'sea' ? pricing.seaTotal : null) ?? pricing.itemsNetFcfa,
      })
      .eq('id', orderId);
    return { ok: false, reason: `${reason} Le code a été retiré et votre total mis à jour.` };
  }

  await confirmPromoUse(orderId);
  return { ok: true, applied: true };
}
