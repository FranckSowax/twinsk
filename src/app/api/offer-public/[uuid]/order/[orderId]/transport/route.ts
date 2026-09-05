import { NextRequest, NextResponse } from 'next/server';
import { notifyOrdersGroup } from '@/lib/order-notify';
import { publicOrigin } from '@/lib/public-origin';
import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/offer-pricing';
import { pricingOptionsFor } from '@/lib/promo';

// PATCH: Customer picks a transport mode ('air' | 'sea' | 'quote') and we
// persist the corresponding transport_cost + grand_total.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> }
) {
  const { uuid, orderId } = await params;
  const body = await request.json().catch(() => ({}));
  const mode = body.transport_mode as 'air' | 'sea' | 'quote' | undefined;
  if (!mode || !['air', 'sea', 'quote'].includes(mode)) {
    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 });
  }

  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('*') // colonnes promo incluses si la migration 56 est passée (sinon undefined)
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }

  type LineRow = {
    product_id: string | null;
    variant_id: string | null;
    quantity: number;
    unit_price_cny: number;
    weight: number | null;
    volume: number | null;
    has_battery: boolean | null;
  };
  // `*` (et non une liste explicite) pour rester résilient si les colonnes snapshot
  // weight/volume/has_battery (migration 30) manquent encore : elles deviennent alors
  // `undefined` et le poids/volume est re-résolu depuis la variante ci-dessous.
  const { data: lines } = await supabaseAdmin
    .from('offer_order_lines')
    .select('*')
    .eq('order_id', orderId);

  // Poids/volume/batterie : snapshot LIGNE (variante) → variante produit → produit.
  type Vari = { id?: string; weight?: number | null; volume?: number | null };
  type WL = { id: string; weight: number | null; volume: number | null; has_battery: boolean; variants: Vari[] | null };
  const ids = Array.from(new Set((lines || []).map((l: LineRow) => l.product_id).filter(Boolean))) as string[];
  const { data: prods } = await supabaseAdmin
    .from('offer_products')
    .select('id, weight, volume, has_battery, variants')
    .in('id', ids.length ? ids : ['']);
  const pm = new Map<string, WL>(((prods || []) as WL[]).map((p) => [p.id, p]));

  const pricing = computeOrderPricing(
    (lines || []).map((l: LineRow) => {
      const meta = l.product_id ? pm.get(l.product_id) : undefined;
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

  let transportCost: number | null = null;
  let grandTotal: number | null = pricing.itemsNetFcfa;
  if (mode === 'air') {
    if (!pricing.airAvailable) {
      return NextResponse.json(
        { error: 'Fret aérien indisponible (poids manquant)' },
        { status: 400 }
      );
    }
    transportCost = pricing.airCost;
    grandTotal = pricing.airTotal;
  } else if (mode === 'sea') {
    if (!pricing.seaAvailable) {
      return NextResponse.json(
        { error: 'Fret maritime indisponible (volume manquant)' },
        { status: 400 }
      );
    }
    transportCost = pricing.seaCost;
    grandTotal = pricing.seaTotal;
  } else {
    // 'quote' = devis sur mesure : pas de transport auto. Le total transport
    // sera fixé par l'admin. On garde le total produits (non-null : la colonne
    // grand_total_fcfa est NOT NULL) — le transport n'y est pas encore inclus.
    transportCost = null;
    grandTotal = pricing.itemsNetFcfa;
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('offer_orders')
    .update({
      transport_mode: mode,
      transport_cost: transportCost,
      items_total_fcfa: pricing.itemsTotalFcfaRounded,
      total_weight: pricing.totalWeight,
      total_volume: pricing.totalVolume,
      grand_total_fcfa: grandTotal,
      status: 'transport_selected',
    })
    .eq('id', orderId)
    .select()
    .single();
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  // Devis transport sur mesure : la commande est complète ici (coordonnées déjà
  // fournies à la création, pas d'étape paiement) → récap dans le groupe
  // Commandes, une seule fois (pas de doublon si le client re-clique « devis »).
  if (mode === 'quote' && order.transport_mode !== 'quote') {
    await notifyOrdersGroup(orderId, publicOrigin(request)).catch((e) =>
      console.error('[transport] notification devis impossible', e instanceof Error ? e.message : e),
    );
  }
  return NextResponse.json({ success: true, order: updated, pricing });
}
