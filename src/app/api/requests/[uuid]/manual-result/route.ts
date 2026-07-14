import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { upsertCatalog } from '@/lib/catalog';
import { resolveActor, logCollabAction } from '@/lib/collab';

// POST: Add a manual product result to a request item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { uuid: reqUuid } = await params;
    await logCollabAction(actor, { action: 'add_product', target_type: 'request', target_id: reqUuid, description: 'Produit ajouté manuellement' });
    const body = await request.json();
    const {
      request_item_id,
      title,
      description,
      description_admin,
      price,
      image_url,
      extra_images,
      videos,
      product_url,
      seller,
      moq,
      weight,
      volume,
      dimensions,
      supplier_shipping_price,
      delivery_time,
      quantity,
      variants,
    } = body;

    // Normalize extra_images: only keep non-empty strings, drop duplicates with main image
    const extraImagesArr: string[] = Array.isArray(extra_images)
      ? extra_images.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
      : [];
    const dedupedExtras = Array.from(
      new Set(extraImagesArr.filter((u) => u !== image_url))
    );

    // Normalize videos
    const videosArr: string[] = Array.isArray(videos)
      ? videos.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
      : [];
    const dedupedVideos = Array.from(new Set(videosArr));

    // Normalize variants: only keep entries with a non-empty name; coerce numerics.
    type IncomingVariant = {
      id?: string;
      name?: string;
      price?: unknown;
      moq?: unknown;
      weight?: unknown;
      volume?: unknown;
      dimensions?: unknown;
      capacity?: unknown;
    };
    const numOrNull = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };
    const strOrNull = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length ? t : null;
    };
    const cleanedVariants = Array.isArray(variants)
      ? (variants as IncomingVariant[])
          .map((v) => ({
            id: typeof v.id === 'string' && v.id ? v.id : `v_${Math.random().toString(36).slice(2, 10)}`,
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

    if (!request_item_id) {
      return NextResponse.json({ error: 'request_item_id requis' }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    }

    const insertData = {
      request_item_id,
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
      selected: false,
      quantity: typeof quantity === 'number' ? quantity : parseInt(quantity) || 1,
      margin_percent: 0,
      moq: moq != null && moq !== '' ? Number(moq) : null,
      weight: weight != null && weight !== '' ? Number(weight) : null,
      volume: volume != null && volume !== '' ? Number(volume) : null,
      dimensions: dimensions?.trim() || null,
      supplier_shipping_price: numOrNull(supplier_shipping_price),
      delivery_time: strOrNull(delivery_time),
      client_quantity: null,
    };

    // Upsert into catalog
    const extId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const catalogEntry = await upsertCatalog({
      source: 'manual',
      external_id: extId,
      title: insertData.title,
      description: insertData.description ?? undefined,
      price: insertData.price,
      image_url: insertData.image_url || undefined,
      main_image_url: insertData.main_image_url ?? undefined,
      extra_images: insertData.extra_images ?? undefined,
      variants: insertData.variants ?? undefined,
      seller: insertData.seller ?? undefined,
      product_url: insertData.product_url || undefined,
      moq: insertData.moq ?? undefined,
      weight: insertData.weight ?? undefined,
      volume: insertData.volume ?? undefined,
      dimensions: insertData.dimensions ?? undefined,
    });

    const { data, error } = await supabaseAdmin
      .from('search_results')
      .insert({
        ...insertData,
        catalog_id: catalogEntry?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Manual result insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Manual result route error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
