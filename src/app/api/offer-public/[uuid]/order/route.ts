import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { mirrorOrderToRequest } from '@/lib/offer-order-mirror';

interface Pick {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

// POST: Customer validates a selection from an offer.
// Body: {
//   client_name, client_phone, client_email?,
//   picks: [{ product_id, variant_id?, quantity }]
// }
// Side effects:
//  - Inserts a row in offer_orders + offer_order_lines
//  - Mirrors the selection into requests / request_items / search_results so the
//    admin sees a new "demande" under /admin/requests.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const body = (await request.json()) as {
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    picks?: Pick[];
  };

  // Coordonnées désormais OPTIONNELLES à la création : elles sont saisies plus
  // tard sur la page commande (après le choix du transport, avant le paiement).
  // Le miroir vers /admin/requests est différé jusqu'à la saisie des coordonnées
  // (route .../contact) pour éviter des demandes fantômes de paniers abandonnés.
  const clientName = (body.client_name || '').trim();
  const clientPhone = (body.client_phone || '').trim();
  const clientEmail = (body.client_email || '').trim();

  const picks = Array.isArray(body.picks) ? body.picks : [];
  if (!picks.length) {
    return NextResponse.json({ error: 'Aucun produit sélectionné' }, { status: 400 });
  }

  // Verify offer
  const { data: offer } = await supabaseAdmin
    .from('offers')
    .select('id, title, status')
    .eq('id', uuid)
    .single();
  if (!offer || offer.status !== 'published') {
    return NextResponse.json({ error: 'Offre non publique' }, { status: 404 });
  }

  // Load products
  const productIds = picks.map((p) => p.product_id).filter(Boolean);
  if (!productIds.length) {
    return NextResponse.json({ error: 'Produits invalides' }, { status: 400 });
  }
  const { data: products } = await supabaseAdmin
    .from('offer_products')
    .select(
      'id, offer_item_id, title, description, price, image_url, main_image_url, extra_images, variants, seller, product_url, margin_percent, moq, weight, volume, dimensions, has_battery'
    )
    .in('id', productIds);

  if (!products?.length) {
    return NextResponse.json({ error: 'Produits introuvables' }, { status: 400 });
  }

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
  };
  const productMap = new Map<string, ProductRow>(
    (products as ProductRow[]).map((p) => [p.id, p])
  );

  // Build lines
  let itemsTotalCny = 0;
  const lineRows: Record<string, unknown>[] = [];
  let anyBattery = false;

  for (const pick of picks) {
    const product = productMap.get(pick.product_id);
    if (!product) continue;
    const qty = Math.max(1, Math.trunc(Number(pick.quantity) || 1));
    const variant = pick.variant_id
      ? product.variants?.find((v) => v.id === pick.variant_id) || null
      : null;
    const baseUnit = variant && variant.price != null ? variant.price : product.price;
    const unitWithMargin = baseUnit * (1 + (product.margin_percent || 0) / 100);
    const subtotal = unitWithMargin * qty;
    itemsTotalCny += subtotal;
    if (product.has_battery) anyBattery = true;
    lineRows.push({
      product_id: product.id,
      variant_id: variant?.id || null,
      variant_name: variant?.name || null,
      unit_price_cny: unitWithMargin,
      quantity: qty,
      subtotal_cny: subtotal,
      // Snapshot produit (nom + image + URL 1688) — robuste à la suppression du produit.
      product_title: product.title,
      product_image: product.main_image_url || product.image_url || null,
      product_url: product.product_url || null,
      // Snapshot poids/volume/batterie (variante prioritaire) — éditable par l'admin.
      weight: variant?.weight ?? product.weight ?? null,
      volume: variant?.volume ?? product.volume ?? null,
      has_battery: product.has_battery ?? null,
    });
  }

  if (!lineRows.length) {
    return NextResponse.json({ error: 'Aucun produit valide' }, { status: 400 });
  }

  // 1. Create the offer_order
  const { data: orderRow, error: orderErr } = await supabaseAdmin
    .from('offer_orders')
    .insert({
      offer_id: uuid,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail || null,
      items_total_cny: itemsTotalCny,
      has_battery: anyBattery,
      status: 'cart',
    })
    .select()
    .single();
  if (orderErr || !orderRow) {
    return NextResponse.json(
      { error: orderErr?.message || 'Erreur création commande' },
      { status: 500 }
    );
  }

  // 2. Insert order lines
  const linesWithOrder = lineRows.map((l) => ({ ...l, order_id: orderRow.id }));
  await supabaseAdmin.from('offer_order_lines').insert(linesWithOrder);

  // 3. Le miroir vers /admin/requests est créé plus tard, quand le client
  //    renseigne ses coordonnées (route .../contact). Cf. mirrorOrderToRequest.
  if (clientName && clientPhone) {
    // Compat : si des coordonnées sont fournies dès la création (ancien flux),
    // on met à jour et on crée le miroir immédiatement.
    await supabaseAdmin
      .from('offer_orders')
      .update({ client_name: clientName, client_phone: clientPhone, client_email: clientEmail || null })
      .eq('id', orderRow.id);
    const requestId = await mirrorOrderToRequest({
      orderId: orderRow.id,
      offerTitle: offer.title,
      clientName,
      clientPhone,
      clientEmail,
    });
    return NextResponse.json({ success: true, order_id: orderRow.id, request_id: requestId });
  }

  return NextResponse.json({ success: true, order_id: orderRow.id, request_id: null });
}
