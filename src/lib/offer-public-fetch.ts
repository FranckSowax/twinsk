// Server-side helper used by both the public offer page (Server Component)
// and the /api/offer-public/[uuid] route. Avoid re-fetching over HTTP from a
// Server Component on Railway where localhost:port is unreliable.

import { supabaseAdmin } from './supabase/server';
import { sanitizeForPublic } from './utils/shortenTitle';

interface RawProduct {
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
  dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
  has_battery: boolean;
  info_manquante: string | null;
  margin_percent: number;
  selected: boolean;
}

interface RawItem {
  id: string;
  image_url: string | null;
  description: string | null;
  position: number;
  offer_products: RawProduct[];
}

export interface PublicOfferData {
  offer: {
    id: string;
    title: string;
    theme: string | null;
    description: string | null;
    cover_image_url: string | null;
  };
  items: Array<{
    id: string;
    image_url: string | null;
    description: string | null;
    products: Array<{
      id: string;
      title: string;
      title_original: string | null;
      description: string | null;
      image_url: string;
      thumbnail_url: string;
      gallery: string[];
      price: number;
      moq: number | null;
      weight: number | null;
      volume: number | null;
      dimensions: string | null;
      dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
      has_battery: boolean;
      info_manquante: string | null;
      seller: string | null;
      product_url: string;
      variants: Array<{
        id: string;
        name: string;
        image_url: string | null;
        price: number | null;
        moq: number | null;
        weight: number | null;
        volume: number | null;
        dimensions: string | null;
        capacity: string | null;
      }> | null;
    }>;
  }>;
}

export async function fetchPublicOffer(uuid: string): Promise<PublicOfferData | null> {
  const { data: offer, error: offerErr } = await supabaseAdmin
    .from('offers')
    .select('id, title, theme, description, cover_image_url, status, created_at')
    .eq('id', uuid)
    .single();
  if (offerErr || !offer) return null;
  if (offer.status !== 'published') return null;

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('offer_items')
    .select('id, image_url, description, position, offer_products(*)')
    .eq('offer_id', uuid)
    .order('position');
  if (itemsErr) return null;

  const typedItems = (items || []) as unknown as RawItem[];

  const publicItems = typedItems
    .map((item) => ({
      id: item.id,
      image_url: item.image_url,
      description: sanitizeForPublic(item.description) || null,
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
            title: sanitizeForPublic(p.title),
            title_original: null, // never expose the source-language title to the customer
            description: sanitizeForPublic(p.description) || null,
            image_url: p.main_image_url || p.image_url,
            thumbnail_url: p.image_url,
            gallery,
            price: priceWithMargin,
            moq: p.moq,
            weight: p.weight,
            volume: p.volume,
            dimensions: p.dimensions,
            dimensions_cm: p.dimensions_cm,
            has_battery: !!p.has_battery,
            info_manquante: sanitizeForPublic(p.info_manquante) || null,
            seller: null, // hide supplier name from the public offer
            product_url: '',
            variants: Array.isArray(p.variants)
              ? (p.variants as unknown[])
                  .map((v) => {
                    const vo = (v || {}) as {
                      id?: string;
                      name?: string;
                      image_url?: string | null;
                      price?: number | null;
                      moq?: number | null;
                      weight?: number | null;
                      volume?: number | null;
                      dimensions?: string | null;
                      capacity?: string | null;
                    };
                    return {
                      id: vo.id || '',
                      name: sanitizeForPublic(vo.name),
                      price:
                        vo.price != null ? vo.price * (1 + margin / 100) : null,
                      moq: vo.moq ?? null,
                      weight: vo.weight ?? null,
                      volume: vo.volume ?? null,
                      dimensions: vo.dimensions ?? null,
                      capacity: vo.capacity ?? null,
                      image_url:
                        (vo as { image_url?: string | null }).image_url ?? null,
                    };
                  })
                  .filter((v) => v.name)
              : null,
          };
        }),
    }))
    .filter((item) => item.products.length > 0);

  return {
    offer: {
      id: offer.id,
      title: sanitizeForPublic(offer.title),
      theme: sanitizeForPublic(offer.theme) || null,
      description: sanitizeForPublic(offer.description) || null,
      cover_image_url: offer.cover_image_url,
    },
    items: publicItems,
  };
}
