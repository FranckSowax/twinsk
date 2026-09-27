// Modification du panier d'une commande existante (ajout / quantité /
// suppression d'une ligne) tant qu'elle n'est pas payée. Après tout
// changement : totaux recalculés, transport à re-choisir (poids et volume ont
// changé), code promo libéré (à ré-appliquer : sa validité dépend du total).

import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/offer-pricing';
import { loadOrderPricingLines, offerSettlementCurrency } from '@/lib/order-pricing-lines';
import { releasePromoUse } from '@/lib/promo';
import { clearOrderSplit } from '@/lib/order-split';
import { insertOrderLines, priceOrderPicks } from '@/lib/offer-order-create';

export interface EditableOrder {
  id: string;
  offer_id: string;
  status: string;
  payment_status: string | null;
  promo_id?: string | null;
  affiliate_offer_id?: string | null;
}

export async function loadEditableOrder(uuid: string, orderId: string): Promise<EditableOrder | { error: string; status: number }> {
  const { data } = await supabaseAdmin.from('offer_orders').select('*').eq('id', orderId).eq('offer_id', uuid).single();
  if (!data) return { error: 'Commande introuvable', status: 404 };
  const o = data as EditableOrder;
  if (o.payment_status === 'submitted' || o.payment_status === 'paid' || o.status === 'paid') {
    return { error: 'Commande déjà payée ou en cours de vérification : le panier ne peut plus être modifié.', status: 409 };
  }
  return o;
}

/** Commission de l'affilié portée par la commande (0 si vente directe). */
export async function orderAffiliateCommission(order: EditableOrder): Promise<number> {
  if (!order.affiliate_offer_id) return 0;
  const { data } = await supabaseAdmin.from('affiliate_offers').select('commission_percent').eq('id', order.affiliate_offer_id).single();
  return Number(data?.commission_percent) || 0;
}

export async function recomputeAfterLineChange(order: EditableOrder): Promise<{ promo_removed: boolean; lines: number }> {
  // `subtotal_cny` seul : la colonne snapshot has_battery (migration 30) peut
  // manquer en prod, et une colonne inconnue ferait échouer toute la requête.
  const { data: rows, error } = await supabaseAdmin.from('offer_order_lines').select('subtotal_cny').eq('order_id', order.id);
  if (error) throw new Error(`lecture des lignes impossible : ${error.message}`);
  const lines = (rows || []) as { subtotal_cny: number }[];
  const itemsTotalCny = lines.reduce((s, l) => s + (Number(l.subtotal_cny) || 0), 0);
  const pricing = computeOrderPricing(await loadOrderPricingLines(order.id), { currency: await offerSettlementCurrency(order.offer_id) });

  const promoRemoved = !!order.promo_id;
  if (promoRemoved) await releasePromoUse(order.id);
  // Répartition avion / bateau caduque : le panier a changé.
  await clearOrderSplit(order.id);

  await supabaseAdmin
    .from('offer_orders')
    .update({
      items_total_cny: itemsTotalCny,
      items_total_fcfa: pricing.itemsTotalFcfaRounded,
      has_battery: pricing.hasBattery,
      // Le transport dépend du poids/volume : à re-choisir.
      transport_mode: null,
      transport_cost: null,
      total_weight: pricing.totalWeight,
      total_volume: pricing.totalVolume,
      grand_total_fcfa: pricing.itemsTotalFcfaRounded,
      status: 'cart',
      ...(promoRemoved ? { promo_id: null, promo_code: null, promo_kind: null, promo_rate: null, promo_discount_fcfa: 0 } : {}),
    })
    .eq('id', order.id);
  return { promo_removed: promoRemoved, lines: lines.length };
}

/**
 * Ajoute un produit du listing au panier d'une commande modifiable. Même produit
 * et même variante déjà présents : quantité cumulée, sauf `skipIfPresent`
 * (sélection client : un 2ᵉ appui ne double pas la quantité).
 */
export async function addProductToOrder(
  order: EditableOrder,
  pick: { product_id: string; variant_id?: string | null; quantity?: number },
  opts: { skipIfPresent?: boolean } = {},
): Promise<{ ok: true; added: boolean; promo_removed: boolean; lines: number } | { ok: false; error: string; status: number }> {
  const qty = Math.max(1, Math.trunc(Number(pick.quantity) || 1));
  // Le produit doit appartenir au listing de la commande.
  const { data: prod } = await supabaseAdmin
    .from('offer_products')
    .select('id, offer_items!inner(offer_id)')
    .eq('id', pick.product_id)
    .single();
  const belongs = (prod as { offer_items?: { offer_id?: string } | { offer_id?: string }[] } | null)?.offer_items;
  const offerOfProduct = Array.isArray(belongs) ? belongs[0]?.offer_id : belongs?.offer_id;
  if (!prod || offerOfProduct !== order.offer_id) return { ok: false, error: 'Produit hors du listing', status: 400 };

  let q = supabaseAdmin.from('offer_order_lines').select('id, quantity, unit_price_cny').eq('order_id', order.id).eq('product_id', pick.product_id);
  q = pick.variant_id ? q.eq('variant_id', pick.variant_id) : q.is('variant_id', null);
  const { data: existing } = await q.maybeSingle();
  if (existing) {
    if (opts.skipIfPresent) return { ok: true, added: false, promo_removed: false, lines: 0 };
    const newQty = Number(existing.quantity) + qty;
    await supabaseAdmin
      .from('offer_order_lines')
      .update({ quantity: newQty, subtotal_cny: Number(existing.unit_price_cny) * newQty })
      .eq('id', existing.id);
  } else {
    const priced = await priceOrderPicks([{ product_id: pick.product_id, variant_id: pick.variant_id || null, quantity: qty }], await orderAffiliateCommission(order));
    if ('error' in priced) return { ok: false, error: priced.error, status: priced.status };
    const err = await insertOrderLines(order.id, priced.lineRows);
    if (err) return { ok: false, error: err, status: 500 };
  }
  const r = await recomputeAfterLineChange(order);
  return { ok: true, added: true, ...r };
}
