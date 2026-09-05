import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing, CNY_TO_FCFA } from '@/lib/offer-pricing';
import { describePromo, pricingOptionsFor, type PromoKind } from '@/lib/promo';

// GET: Public order detail (for the confirmation / transport / checkout page).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> }
) {
  const { uuid, orderId } = await params;

  const { data: order, error } = await supabaseAdmin
    .from('offer_orders')
    .select('*, offer_order_lines(*)')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (error || !order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  // Recompute pricing dynamically based on the persisted lines so the customer
  // sees up-to-date totals even if the order is recalled later.
  type LineRow = {
    id: string;
    product_id: string | null;
    variant_id: string | null;
    variant_name: string | null;
    unit_price_cny: number;
    quantity: number;
    subtotal_cny: number;
    // Snapshot poids/volume/batterie (capte la variante à la commande, migration 30).
    weight: number | null;
    volume: number | null;
    has_battery: boolean | null;
  };
  const lines = (order.offer_order_lines || []) as LineRow[];

  // Poids/volume/batterie : priorité au snapshot de la LIGNE (variante), sinon
  // repli sur le produit (anciennes commandes avant migration 30).
  const productIds = Array.from(new Set(lines.map((l) => l.product_id).filter(Boolean))) as string[];
  type Vari = { id?: string; weight?: number | null; volume?: number | null };
  type WL = { id: string; weight: number | null; volume: number | null; has_battery: boolean; variants: Vari[] | null };
  const { data: prodRows } = productIds.length
    ? await supabaseAdmin
        .from('offer_products')
        .select('id, weight, volume, has_battery, variants')
        .in('id', productIds)
    : { data: [] as WL[] };
  const prodMap = new Map<string, WL>(
    ((prodRows || []) as WL[]).map((p) => [p.id, p])
  );

  // Valeur affichée du code promo : la commande ne conserve que le tarif fret
  // négocié (promo_rate). Pour une remise articles (% ou FCFA) la valeur vit
  // sur le code lui-même — sans cette relecture le libellé disait « −0 % ».
  let promoValue = Number(order.promo_rate ?? 0) || 0;
  if (order.promo_id && order.promo_rate == null) {
    const { data: promoRow } = await supabaseAdmin
      .from('promo_codes')
      .select('value')
      .eq('id', order.promo_id)
      .maybeSingle();
    promoValue = Number(promoRow?.value ?? 0) || 0;
  }

  const pricing = computeOrderPricing(
    lines.map((l) => {
      const meta = l.product_id ? prodMap.get(l.product_id) : undefined;
      // Résolution poids/volume : snapshot ligne → variante du produit → produit.
      const vari = l.variant_id && Array.isArray(meta?.variants)
        ? meta!.variants.find((v) => v.id === l.variant_id)
        : undefined;
      return {
        unit_price_cny: l.unit_price_cny,
        quantity: l.quantity,
        weight: l.weight ?? vari?.weight ?? meta?.weight ?? null,
        volume: l.volume ?? vari?.volume ?? meta?.volume ?? null,
        has_battery: l.has_battery ?? !!meta?.has_battery,
      };
    }),
    pricingOptionsFor(order),
  );

  return NextResponse.json({
    order: {
      id: order.id,
      offer_id: order.offer_id,
      client_name: order.client_name,
      client_phone: order.client_phone,
      client_email: order.client_email,
      transport_mode: order.transport_mode,
      transport_cost: order.transport_cost,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method ?? null,
      payment_proof_url: order.payment_proof_url ?? null,
      ebilling_reference: order.ebilling_reference,
      created_at: order.created_at,
      request_id: order.request_id,
      promo: order.promo_code
        ? {
            code: order.promo_code as string,
            kind: order.promo_kind as PromoKind,
            label: describePromo({ kind: order.promo_kind as PromoKind, value: promoValue }),
            discount_fcfa: Number(order.promo_discount_fcfa) || 0,
            rate: order.promo_rate == null ? null : Number(order.promo_rate),
          }
        : null,
    },
    lines: lines.map((l) => ({
      ...l,
      unit_price_fcfa: l.unit_price_cny * CNY_TO_FCFA,
      subtotal_fcfa: l.subtotal_cny * CNY_TO_FCFA,
    })),
    pricing,
    // Numéro Airtel Money affiché dans les instructions de paiement :
    // celui de l'affilié (marque blanche) si la vente lui est attribuée, sinon Twinsk (env).
    airtel_number: await resolveAirtelNumber(order as { affiliate_id?: string | null }),
  });
}

async function resolveAirtelNumber(order: { affiliate_id?: string | null }): Promise<string | null> {
  if (order.affiliate_id) {
    const { data } = await supabaseAdmin
      .from('affiliates')
      .select('airtel_number')
      .eq('id', order.affiliate_id)
      .single();
    if (data?.airtel_number) return data.airtel_number;
  }
  return process.env.AIRTEL_MONEY_NUMBER || null;
}
