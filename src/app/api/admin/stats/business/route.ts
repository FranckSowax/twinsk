import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';
import { settlementCurrencyOf } from '@/lib/offer-pricing';
import {
  byListing,
  byTransport,
  monthlySeries,
  totalsInFcfa,
  type BusinessLine,
  type BusinessOrder,
} from '@/lib/admin-business';

// GET : indicateurs commerciaux du tableau de bord — CA, marge produits,
// transport facturé, sur les commandes PAYÉES (et, à part, celles dont le
// paiement est engagé). ?months=6 pour la profondeur de la série mensuelle.
export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  created_at: string;
  offer_id: string | null;
  payment_status: string;
  transport_mode: string | null;
  transport_cost: number | null;
  items_total_fcfa: number | null;
  promo_discount_fcfa: number | null;
  commission_fcfa: number | null;
  offers: { title?: string | null; offer_currency?: string | null } | null;
  offer_order_lines: {
    product_id: string | null;
    quantity: number | null;
    unit_price_cny: number | null;
    price_type?: string | null;
  }[] | null;
}

export async function GET(request: NextRequest) {
  if (!(await resolveActor(request, ['commandes']))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const months = Math.min(24, Math.max(3, Number(request.nextUrl.searchParams.get('months')) || 6));

  const { data, error } = await supabaseAdmin
    .from('offer_orders')
    .select(
      'id, created_at, offer_id, payment_status, transport_mode, transport_cost, items_total_fcfa, ' +
        'promo_discount_fcfa, commission_fcfa, offers(title, offer_currency), ' +
        'offer_order_lines(product_id, quantity, unit_price_cny, price_type)',
    )
    .in('payment_status', ['paid', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as unknown as OrderRow[];
  // Marge des produits vendus : `margin_percent` courant de chaque produit.
  const ids = Array.from(
    new Set(rows.flatMap((o) => (o.offer_order_lines || []).map((l) => l.product_id)).filter(Boolean)),
  ) as string[];
  const { data: prods } = ids.length
    ? await supabaseAdmin.from('offer_products').select('id, margin_percent').in('id', ids)
    : { data: [] as { id: string; margin_percent: number | null }[] };
  const marginOf = new Map((prods || []).map((p) => [p.id as string, Number(p.margin_percent) || 0]));
  let linesWithoutMargin = 0;

  const toBusiness = (o: OrderRow): BusinessOrder => ({
    id: o.id,
    created_at: o.created_at,
    offer_id: o.offer_id,
    offer_title: o.offers?.title ?? null,
    currency: settlementCurrencyOf(o.offers?.offer_currency),
    transport_mode: o.transport_mode,
    items_total: Number(o.items_total_fcfa) || 0,
    transport_cost: Number(o.transport_cost) || 0,
    discount: Number(o.promo_discount_fcfa) || 0,
    commission: Number(o.commission_fcfa) || 0,
    lines: (o.offer_order_lines || []).map((l): BusinessLine => {
      const known = l.product_id && marginOf.has(l.product_id);
      if (!known && l.price_type !== 'acompte') linesWithoutMargin += 1;
      return {
        product_id: l.product_id,
        quantity: Number(l.quantity) || 0,
        unit_price_cny: Number(l.unit_price_cny) || 0,
        margin_percent: known ? marginOf.get(l.product_id as string)! : 0,
        price_type: l.price_type ?? null,
      };
    }),
  });

  const paid = rows.filter((o) => o.payment_status === 'paid').map(toBusiness);
  const engaged = rows.filter((o) => o.payment_status === 'submitted').map(toBusiness);

  return NextResponse.json({
    currency: 'XAF',
    totals: totalsInFcfa(paid),
    engaged: totalsInFcfa(engaged),
    monthly: monthlySeries(paid, months),
    listings: byListing(paid, 5),
    transport: byTransport(paid),
    // Lignes dont le produit a disparu du catalogue : marge inconnue, comptée à 0.
    lines_without_margin: linesWithoutMargin,
  });
}
