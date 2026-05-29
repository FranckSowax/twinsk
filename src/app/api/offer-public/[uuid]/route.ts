import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Public-facing view of an offer.
// Only returns:
//  - offers with status='published'
//  - offer_products marked as selected=true
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  const { data: offer, error: offerErr } = await supabaseAdmin
    .from('offers')
    .select('id, title, theme, description, cover_image_url, status, created_at')
    .eq('id', uuid)
    .single();
  if (offerErr || !offer) {
    return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });
  }
  if (offer.status !== 'published') {
    return NextResponse.json(
      { error: "Cette offre n'est pas publique" },
      { status: 404 }
    );
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('offer_items')
    .select('id, image_url, description, position, offer_products(*)')
    .eq('offer_id', uuid)
    .order('position');
  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  type RawProduct = {
    id: string;
    title: string;
    title_original: string | null;
    description: string | null;
    price: number;
    image_url: string;
    main_image_url: string | null;
    extra_images: string[] | null;
    variants: unknown[] | null;
    seller: string | null;
    product_url: string;
    moq: number | null;
    weight: number | null;
    volume: number | null;
    dimensions: string | null;
    has_battery: boolean;
    margin_percent: number;
    selected: boolean;
  };
  type RawItem = {
    id: string;
    image_url: string | null;
    description: string | null;
    offer_products: RawProduct[];
  };
  const typedItems = (items || []) as unknown as RawItem[];

  const publicItems = typedItems
    .map((item) => ({
      id: item.id,
      image_url: item.image_url,
      description: item.description,
      products: (item.offer_products || [])
        .filter((p) => p.selected)
        .map((p) => {
          const gallery: string[] = [];
          if (p.main_image_url) gallery.push(p.main_image_url);
          else if (p.image_url) gallery.push(p.image_url);
          if (p.extra_images?.length) {
            for (const u of p.extra_images) {
              if (u && !gallery.includes(u)) gallery.push(u);
            }
          }
          if (p.image_url && !gallery.includes(p.image_url)) gallery.push(p.image_url);
          const margin = p.margin_percent || 0;
          const priceWithMargin = p.price * (1 + margin / 100);
          return {
            id: p.id,
            title: p.title,
            title_original: p.title_original,
            description: p.description,
            image_url: p.main_image_url || p.image_url,
            thumbnail_url: p.image_url,
            gallery,
            price: priceWithMargin, // already includes margin
            moq: p.moq,
            weight: p.weight,
            volume: p.volume,
            dimensions: p.dimensions,
            has_battery: p.has_battery,
            seller: p.seller,
            product_url: p.product_url,
            variants: Array.isArray(p.variants)
              ? (p.variants as unknown[])
                  .map((v) => {
                    const vo = (v || {}) as {
                      id?: string;
                      name?: string;
                      price?: number | null;
                      moq?: number | null;
                      weight?: number | null;
                      volume?: number | null;
                      dimensions?: string | null;
                      capacity?: string | null;
                    };
                    return {
                      id: vo.id || '',
                      name: (vo.name || '').trim(),
                      price:
                        vo.price != null ? vo.price * (1 + margin / 100) : null,
                      moq: vo.moq ?? null,
                      weight: vo.weight ?? null,
                      volume: vo.volume ?? null,
                      dimensions: vo.dimensions ?? null,
                      capacity: vo.capacity ?? null,
                    };
                  })
                  .filter((v) => v.name)
              : null,
          };
        }),
    }))
    .filter((item) => item.products.length > 0);

  return NextResponse.json({
    offer: {
      id: offer.id,
      title: offer.title,
      theme: offer.theme,
      description: offer.description,
      cover_image_url: offer.cover_image_url,
    },
    items: publicItems,
  });
}
