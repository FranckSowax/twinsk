import { supabaseAdmin } from '@/lib/supabase/server';

// Crée le miroir d'une commande /offer dans /admin/requests (requests +
// request_items + search_results) et rattache la commande à la demande créée.
// Appelé quand le client renseigne ses coordonnées (route .../contact), ou à la
// création si les coordonnées sont fournies d'emblée (ancien flux).
// Reconstruit la sélection depuis offer_order_lines + offer_products.
// Idempotent-ish : ne rien faire si la commande a déjà un request_id.
export async function mirrorOrderToRequest(args: {
  orderId: string;
  offerTitle: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
}): Promise<string | null> {
  const { orderId, offerTitle, clientName, clientPhone, clientEmail } = args;

  // Déjà miroité ?
  const { data: existing } = await supabaseAdmin
    .from('offer_orders')
    .select('request_id')
    .eq('id', orderId)
    .single();
  if (existing?.request_id) return existing.request_id as string;

  // Lignes de la commande
  const { data: lines } = await supabaseAdmin
    .from('offer_order_lines')
    .select('product_id, variant_id, quantity')
    .eq('order_id', orderId);
  const orderLines = (lines || []) as {
    product_id: string | null;
    variant_id: string | null;
    quantity: number;
  }[];

  const productIds = orderLines.map((l) => l.product_id).filter(Boolean) as string[];

  // Produits (pour hériter les champs dans search_results)
  const { data: products } = productIds.length
    ? await supabaseAdmin
        .from('offer_products')
        .select(
          'id, title, description, price, image_url, main_image_url, extra_images, variants, seller, product_url, margin_percent, moq, weight, volume, dimensions',
        )
        .in('id', productIds)
    : { data: [] as unknown[] };
  type P = {
    id: string;
    title: string;
    description: string | null;
    price: number | null;
    image_url: string;
    main_image_url: string | null;
    extra_images: string[] | null;
    variants: unknown;
    seller: string | null;
    product_url: string;
    margin_percent: number;
    moq: number | null;
    weight: number | null;
    volume: number | null;
    dimensions: string | null;
  };
  const pmap = new Map<string, P>(((products || []) as P[]).map((p) => [p.id, p]));

  // 1. requests
  const { data: requestRow } = await supabaseAdmin
    .from('requests')
    .insert({
      client_name: clientName,
      client_email: clientEmail || null,
      client_phone: clientPhone,
      notes: `Commande issue de l'offre "${offerTitle}"`,
      status: 'submitted',
    })
    .select()
    .single();
  if (!requestRow) return null;

  // 2. request_items
  const { data: itemRow } = await supabaseAdmin
    .from('request_items')
    .insert({
      request_id: requestRow.id,
      image_url: null,
      description: `Sélection offre ${offerTitle}`,
      processed: true,
      added_by: 'admin',
    })
    .select()
    .single();

  // 3. search_results (hérite des données produit)
  if (itemRow) {
    const srRows = orderLines
      .map((l) => {
        const product = l.product_id ? pmap.get(l.product_id) : null;
        if (!product) return null;
        const qty = Math.max(1, Math.trunc(Number(l.quantity) || 1));
        return {
          request_item_id: itemRow.id,
          source: 'manual',
          taobao_item_id: '',
          title: product.title,
          description: product.description,
          price: product.price,
          image_url: product.image_url,
          main_image_url: product.main_image_url,
          extra_images: product.extra_images,
          variants: product.variants,
          seller: product.seller,
          product_url: product.product_url,
          selected: true,
          quantity: qty,
          margin_percent: product.margin_percent,
          moq: product.moq,
          weight: product.weight,
          volume: product.volume,
          dimensions: product.dimensions,
          client_quantity: qty,
          client_selected: true,
          client_variant_id: l.variant_id || null,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];
    if (srRows.length) {
      await supabaseAdmin.from('search_results').insert(srRows);
    }
  }

  // 4. Rattache la commande à la demande
  await supabaseAdmin
    .from('offer_orders')
    .update({ request_id: requestRow.id })
    .eq('id', orderId);

  return requestRow.id as string;
}
