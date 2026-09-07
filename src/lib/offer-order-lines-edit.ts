// Modification du panier d'une commande existante (ajout / quantité /
// suppression d'une ligne) tant qu'elle n'est pas payée. Après tout
// changement : totaux recalculés, transport à re-choisir (poids et volume ont
// changé), code promo libéré (à ré-appliquer : sa validité dépend du total).

import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/offer-pricing';
import { loadOrderPricingLines } from '@/lib/order-pricing-lines';
import { releasePromoUse } from '@/lib/promo';

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
  const pricing = computeOrderPricing(await loadOrderPricingLines(order.id));

  const promoRemoved = !!order.promo_id;
  if (promoRemoved) await releasePromoUse(order.id);

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
