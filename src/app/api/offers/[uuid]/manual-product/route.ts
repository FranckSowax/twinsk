import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}
function makeId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// POST: Create a manual offer_product attached to an offer_item.
// Body fields mirror /api/requests/[uuid]/manual-result for cross-component reuse.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;

  const body = await request.json();
  const {
    request_item_id, // re-used as offer_item_id
    title,
    description,
    description_admin,
    price,
    image_url,
    extra_images,
    videos,
    variants,
    product_url,
    seller,
    moq,
    weight,
    volume,
    dimensions,
    supplier_shipping_price,
    delivery_time,
    quantity,
    has_battery,
  } = body;

  if (!request_item_id) {
    return NextResponse.json({ error: 'offer_item_id requis' }, { status: 400 });
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
  }

  // Normalize extra_images
  const extras: string[] = Array.isArray(extra_images)
    ? extra_images.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
    : [];
  const dedupedExtras = Array.from(new Set(extras.filter((u) => u !== image_url)));

  // Normalize videos
  const videosArr: string[] = Array.isArray(videos)
    ? videos.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
    : [];
  const dedupedVideos = Array.from(new Set(videosArr));

  // Normalize variants
  type InVariant = {
    id?: string;
    name?: string;
    price?: unknown;
    moq?: unknown;
    weight?: unknown;
    volume?: unknown;
    dimensions?: unknown;
    capacity?: unknown;
  };
  const cleanedVariants = Array.isArray(variants)
    ? (variants as InVariant[])
        .map((v) => ({
          id: typeof v.id === 'string' && v.id ? v.id : makeId(),
          name: typeof v.name === 'string' ? v.name.trim() : '',
          price: numOrNull(v.price),
          moq: numOrNull(v.moq),
          weight: numOrNull(v.weight),
          volume: numOrNull(v.volume),
          dimensions: strOrNull(v.dimensions),
          capacity: strOrNull(v.capacity),
          image_url: strOrNull((v as { image_url?: unknown }).image_url),
        }))
        .filter((v) => v.name.length > 0)
    : [];

  const { data, error } = await supabaseAdmin
    .from('offer_products')
    .insert({
      offer_item_id: request_item_id,
      source: 'manual',
      taobao_item_id: '',
      title: title.trim(),
      title_original: null,
      description: description?.trim() || null,
      description_admin: (description_admin as string | undefined)?.trim() || null,
      price: typeof price === 'number' ? price : parseFloat(price) || 0,
      image_url: image_url || '',
      main_image_url: image_url || null,
      extra_images: dedupedExtras.length ? dedupedExtras : null,
      videos: dedupedVideos.length ? dedupedVideos : null,
      variants: cleanedVariants.length ? cleanedVariants : null,
      seller: seller?.trim() || null,
      product_url: product_url?.trim() || '',
      selected: true,
      quantity: typeof quantity === 'number' ? quantity : parseInt(quantity) || 1,
      margin_percent: 0,
      moq: moq != null && moq !== '' ? Number(moq) : null,
      weight: weight != null && weight !== '' ? Number(weight) : null,
      volume: volume != null && volume !== '' ? Number(volume) : null,
      dimensions: dimensions?.trim() || null,
      has_battery: !!has_battery,
      supplier_shipping_price: numOrNull(supplier_shipping_price),
      delivery_time: strOrNull(delivery_time),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logCollabAction(actor, {
    action: 'add_product',
    target_type: 'offer',
    target_id: uuid,
    description: `Produit ajouté : ${strOrNull(title) || '(sans titre)'}`,
  });
  return NextResponse.json(data);
}
