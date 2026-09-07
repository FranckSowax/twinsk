// Création d'une commande à partir d'un listing publié — logique partagée
// entre le panier client (route publique) et le « Panier client » de l'admin
// (commande préparée puis envoyée sur WhatsApp). Prix, marge, commission
// affilié, lignes snapshot et miroir /admin/requests sont calculés ICI, jamais
// confiés au client.

import { supabaseAdmin } from '@/lib/supabase/server';
import { mirrorOrderToRequest } from '@/lib/offer-order-mirror';
import { CNY_TO_FCFA } from '@/lib/offer-pricing';
import { isAcompte } from '@/lib/acompte';

export interface OrderPick {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface CreateOrderInput {
  offerId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  picks: OrderPick[];
  /** Lien marque blanche (/b/[id]) — attribution de la vente. */
  affiliateRef?: string;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; requestId: string | null; offerTitle: string; allAcompte: boolean }
  | { ok: false; status: number; error: string };

type ProductRow = {
  id: string;
  offer_item_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string;
  main_image_url: string | null;
  extra_images: string[] | null;
  variants:
    | {
        id?: string;
        name?: string;
        price?: number | null;
        moq?: number | null;
        weight?: number | null;
        volume?: number | null;
        dimensions?: string | null;
        capacity?: string | null;
        price_type?: unknown;
      }[]
    | null;
  seller: string | null;
  product_url: string;
  margin_percent: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  has_battery: boolean;
  price_type?: unknown;
};

export interface PricedPicks {
  lineRows: Record<string, unknown>[];
  itemsTotalCny: number;
  commissionCny: number;
  anyBattery: boolean;
}

/**
 * Valorise des choix produit (prix + marge, commission affilié, snapshot) en
 * lignes prêtes à insérer. Partagé entre la création de commande et l'ajout
 * d'un produit à une commande existante.
 */
export async function priceOrderPicks(
  picks: OrderPick[],
  affiliateCommission = 0,
): Promise<PricedPicks | { error: string; status: number }> {
  const productIds = picks.map((p) => p.product_id).filter(Boolean);
  if (!productIds.length) return { error: 'Produits invalides', status: 400 };

  // price_type inclus dans le select ; repli sans lui si la colonne manque
  // (migration 46 pas encore appliquée) — l'import ne doit jamais casser la commande.
  const baseCols =
    'id, offer_item_id, title, description, price, image_url, main_image_url, extra_images, variants, seller, product_url, margin_percent, moq, weight, volume, dimensions, has_battery';
  let prodRes: { data: unknown[] | null; error: unknown } = await supabaseAdmin
    .from('offer_products')
    .select(`${baseCols}, price_type`)
    .in('id', productIds);
  if (prodRes.error) {
    prodRes = await supabaseAdmin.from('offer_products').select(baseCols).in('id', productIds);
  }
  const products = prodRes.data as ProductRow[] | null;
  if (!products?.length) return { error: 'Produits introuvables', status: 400 };
  const productMap = new Map<string, ProductRow>(products.map((p) => [p.id, p]));

  let itemsTotalCny = 0;
  let commissionCny = 0;
  const lineRows: Record<string, unknown>[] = [];
  let anyBattery = false;
  for (const pick of picks) {
    const product = productMap.get(pick.product_id);
    if (!product) continue;
    const qty = Math.max(1, Math.trunc(Number(pick.quantity) || 1));
    const variant = pick.variant_id ? product.variants?.find((v) => v.id === pick.variant_id) || null : null;
    // Ligne « acompte » (devis) : le prix n'est PAS un prix de vente → contribue 0.
    const acompte = isAcompte(product.price_type) || isAcompte(variant?.price_type);
    const baseUnit = variant && variant.price != null ? variant.price : product.price;
    const unitBeforeCommission = acompte ? 0 : baseUnit * (1 + (product.margin_percent || 0) / 100);
    const unitWithMargin = affiliateCommission ? unitBeforeCommission * (1 + affiliateCommission / 100) : unitBeforeCommission;
    if (affiliateCommission && !acompte) commissionCny += (unitWithMargin - unitBeforeCommission) * qty;
    const subtotal = acompte ? 0 : unitWithMargin * qty;
    itemsTotalCny += subtotal;
    if (product.has_battery) anyBattery = true;
    lineRows.push({
      product_id: product.id,
      variant_id: variant?.id || null,
      variant_name: variant?.name || null,
      unit_price_cny: unitWithMargin,
      quantity: qty,
      subtotal_cny: subtotal,
      price_type: acompte ? 'acompte' : null,
      product_title: product.title,
      product_image: product.main_image_url || product.image_url || null,
      product_url: product.product_url || null,
      weight: variant?.weight ?? product.weight ?? null,
      volume: variant?.volume ?? product.volume ?? null,
      has_battery: product.has_battery ?? null,
    });
  }
  if (!lineRows.length) return { error: 'Aucun produit valide', status: 400 };
  return { lineRows, itemsTotalCny, commissionCny, anyBattery };
}

/** Insère des lignes en tolérant l'absence des colonnes snapshot (migration 30). */
export async function insertOrderLines(orderId: string, lineRows: Record<string, unknown>[]): Promise<string | null> {
  const withOrder = lineRows.map((l) => ({ ...l, order_id: orderId }));
  let err = (await supabaseAdmin.from('offer_order_lines').insert(withOrder)).error;
  if (err) {
    const strip = new Set(['weight', 'volume', 'has_battery', 'price_type']);
    const fallback = withOrder.map((l) => Object.fromEntries(Object.entries(l).filter(([k]) => !strip.has(k))));
    err = (await supabaseAdmin.from('offer_order_lines').insert(fallback)).error;
  }
  return err ? err.message || 'Erreur enregistrement des lignes' : null;
}

export async function createOfferOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const { offerId, clientName, clientPhone } = input;
  const clientEmail = (input.clientEmail || '').trim();
  const picks = Array.isArray(input.picks) ? input.picks : [];
  if (!picks.length) return { ok: false, status: 400, error: 'Aucun produit sélectionné' };

  const { data: offer } = await supabaseAdmin.from('offers').select('id, title, status').eq('id', offerId).single();
  if (!offer || offer.status !== 'published') return { ok: false, status: 404, error: 'Offre non publique' };

  // Attribution marque blanche : valide le lien affilié (offre + actif) et
  // récupère sa commission — appliquée SERVEUR.
  let affiliate: { linkId: string; affiliateId: string; commission: number } | null = null;
  if (input.affiliateRef) {
    const { data: aff } = await supabaseAdmin
      .from('affiliate_offers')
      .select('id, offer_id, commission_percent, active, affiliates(id, active)')
      .eq('id', input.affiliateRef)
      .single();
    const a = aff?.affiliates as unknown as { id: string; active: boolean } | null;
    if (aff && aff.offer_id === offerId && aff.active !== false && a && a.active !== false) {
      affiliate = { linkId: aff.id, affiliateId: a.id, commission: Number(aff.commission_percent) || 0 };
    }
  }

  const priced = await priceOrderPicks(picks, affiliate?.commission || 0);
  if ('error' in priced) return { ok: false, status: priced.status, error: priced.error };
  const { lineRows, itemsTotalCny, commissionCny, anyBattery } = priced;

  // 1. Commande
  const { data: orderRow, error: orderErr } = await supabaseAdmin
    .from('offer_orders')
    .insert({
      offer_id: offerId,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail || null,
      items_total_cny: itemsTotalCny,
      has_battery: anyBattery,
      status: 'cart',
      ...(affiliate
        ? {
            affiliate_offer_id: affiliate.linkId,
            affiliate_id: affiliate.affiliateId,
            commission_fcfa: Math.round(commissionCny * CNY_TO_FCFA),
          }
        : {}),
    })
    .select()
    .single();
  if (orderErr || !orderRow) return { ok: false, status: 500, error: orderErr?.message || 'Erreur création commande' };

  // 2. Lignes — pas de commande sans lignes.
  const linesErr = await insertOrderLines(orderRow.id, lineRows);
  if (linesErr) {
    await supabaseAdmin.from('offer_orders').delete().eq('id', orderRow.id);
    return { ok: false, status: 500, error: linesErr };
  }

  // 3. Miroir /admin/requests (les coordonnées sont obligatoires, donc toujours).
  const requestId = await mirrorOrderToRequest({
    orderId: orderRow.id,
    offerTitle: offer.title,
    clientName,
    clientPhone,
    clientEmail,
  });

  return {
    ok: true,
    orderId: orderRow.id,
    requestId,
    offerTitle: offer.title,
    allAcompte: lineRows.every((l) => l.price_type === 'acompte'),
  };
}
