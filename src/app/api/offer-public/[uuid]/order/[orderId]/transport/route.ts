import { NextRequest, NextResponse } from 'next/server';
import { notifyOrdersGroup } from '@/lib/order-notify';
import { publicOrigin } from '@/lib/public-origin';
import { supabaseAdmin } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/offer-pricing';
import { pricingOptionsFor } from '@/lib/promo';
import { loadOrderPricingLines, offerSettlementCurrency } from '@/lib/order-pricing-lines';
import { clearOrderSplit, writeOrderSplit } from '@/lib/order-split';

// PATCH: Customer picks a transport mode ('air' | 'sea' | 'mixed' | 'quote') and we
// persist the corresponding transport_cost + grand_total.
// Body: { transport_mode, split?: { [lineId]: airQty } } — split requis en mode 'mixed'.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> }
) {
  const { uuid, orderId } = await params;
  const body = await request.json().catch(() => ({}));
  const mode = body.transport_mode as 'air' | 'sea' | 'mixed' | 'quote' | undefined;
  if (!mode || !['air', 'sea', 'mixed', 'quote'].includes(mode)) {
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

  // Transport fractionné : répartition { lineId: unités avion } fournie avec le
  // mode « mixed » (le reste de chaque ligne part en bateau). Enregistrée dans
  // wa_settings (pas de colonne), relue par loadOrderPricingLines.
  if (mode === 'mixed') {
    const raw = body.split && typeof body.split === 'object' ? (body.split as Record<string, unknown>) : null;
    if (!raw) return NextResponse.json({ error: 'Répartition avion / bateau manquante' }, { status: 400 });
    const { data: lineRows } = await supabaseAdmin.from('offer_order_lines').select('id, quantity').eq('order_id', orderId);
    const split: Record<string, number> = {};
    for (const l of (lineRows || []) as { id: string; quantity: number }[]) {
      const n = Math.trunc(Number(raw[l.id]));
      split[l.id] = Number.isFinite(n) ? Math.min(Math.max(0, n), Number(l.quantity) || 0) : 0;
    }
    await writeOrderSplit(orderId, split);
  } else {
    await clearOrderSplit(orderId);
  }

  const pricing = computeOrderPricing(await loadOrderPricingLines(orderId), {
    ...pricingOptionsFor(order),
    currency: await offerSettlementCurrency(uuid),
  });

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
  } else if (mode === 'mixed') {
    if (!pricing.mixed || !pricing.mixed.available || pricing.mixed.cost == null) {
      return NextResponse.json(
        { error: 'Transport fractionné indisponible : poids manquant côté avion ou volume manquant côté bateau' },
        { status: 400 },
      );
    }
    transportCost = pricing.mixed.cost;
    grandTotal = pricing.mixed.total;
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
  // Sans coordonnées (nouveau parcours : transport avant nom/WhatsApp), c'est la
  // route .../contact qui notifiera à la saisie — pas de doublon.
  if (mode === 'quote' && order.transport_mode !== 'quote' && order.client_name && order.client_phone) {
    await notifyOrdersGroup(orderId, publicOrigin(request)).catch((e) =>
      console.error('[transport] notification devis impossible', e instanceof Error ? e.message : e),
    );
  }
  return NextResponse.json({ success: true, order: updated, pricing });
}
