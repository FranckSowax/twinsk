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
  price: number | null; // v3.1 : null = « sur devis »
  image_url: string;
  main_image_url: string | null;
  extra_images: string[] | null;
  videos: string[] | null;
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
  position: number | null; // ordre manuel dans la catégorie
  // v3.1
  price_tiers: { min_qty?: number | null; price?: number | null }[] | null;
  detail_images: string[] | null;
  variants_total: number | null;
  // description_source : INTERNE — volontairement non lu ici (jamais exposé au client)
}

interface RawItem {
  id: string;
  image_url: string | null;
  description: string | null;
  position: number;
  phase_id: string | null;
  offer_products: RawProduct[];
}

export interface PublicOfferData {
  offer: {
    id: string;
    title: string;
    theme: string | null;
    description: string | null;
    cover_image_url: string | null;
    cover_video_url: string | null; // cover vidéo mp4 (prioritaire sur l'image)
    mobile_video_url: string | null; // vidéo carrée 1:1 en tête sur mobile (autoplay/boucle)
    note: string | null; // meta.note — chapô/contexte (safe côté client)
    currency: 'CNY' | 'USD' | 'EUR' | 'XAF'; // devise affichée (défaut XAF)
    offer_type: 'b2c' | 'b2b'; // B2B → vue liste par défaut
  };
  phases: Array<{ id: string; title: string }>;
  items: Array<{
    id: string;
    image_url: string | null;
    description: string | null;
    phase_id: string | null;
    products: Array<{
      id: string;
      title: string;
      title_original: string | null;
      description: string | null;
      image_url: string;
      thumbnail_url: string;
      gallery: string[];
      detail_images: string[];
      videos: string[];
      price: number | null; // prix produit exact (null = porté par paliers/variantes)
      from_price: number; // prix d'affichage « à partir de » (0 si « sur devis »)
      on_quote: boolean; // true → afficher « Sur devis » (prix à 0)
      price_tiers: { min_qty: number; price: number }[] | null;
      variants_total: number | null;
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
    .select('id, title, theme, description, cover_image_url, cover_video_url, mobile_video_url, status, created_at, note, offer_currency, offer_type')
    .eq('id', uuid)
    .single();
  if (offerErr || !offer) return null;
  if (offer.status !== 'published') return null;

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('offer_items')
    .select('id, image_url, description, position, phase_id, offer_products(*)')
    .eq('offer_id', uuid)
    .order('position');
  if (itemsErr) return null;

  // Phases (B2B) — ordonnées. Le client verra ses catégories regroupées.
  const { data: phaseRows } = await supabaseAdmin
    .from('offer_phases')
    .select('id, title, position')
    .eq('offer_id', uuid)
    .order('position');
  const phases = ((phaseRows || []) as { id: string; title: string }[]).map((p) => ({
    id: p.id,
    title: sanitizeForPublic(p.title) || 'Phase',
  }));

  const typedItems = (items || []) as unknown as RawItem[];

  const publicItems = typedItems
    .map((item) => ({
      id: item.id,
      image_url: item.image_url,
      description: sanitizeForPublic(item.description) || null,
      phase_id: item.phase_id ?? null,
      products: (item.offer_products || [])
        .filter((p) => p.selected)
        // Ordre manuel (position) si défini ; sinon on garde l'ordre reçu.
        .sort((a, b) => {
          const pa = a.position, pb = b.position;
          if (pa != null && pb != null) return pa - pb;
          if (pa != null) return -1;
          if (pb != null) return 1;
          return 0;
        })
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
          const withMargin = (v: number | null | undefined): number | null =>
            v == null ? null : v * (1 + margin / 100);
          const priceWithMargin = withMargin(p.price);
          // Paliers : applique la marge, conserve l'ordre par min_qty, filtre l'invalide
          const priceTiers = Array.isArray(p.price_tiers)
            ? p.price_tiers
                .map((t) => ({ min_qty: t.min_qty ?? null, price: withMargin(t.price) }))
                .filter((t): t is { min_qty: number; price: number } => t.min_qty != null && t.price != null)
            : null;
          const detailImages = Array.isArray(p.detail_images)
            ? p.detail_images.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            : [];
          const mappedVariants = Array.isArray(p.variants)
            ? (p.variants as unknown[])
                .map((v) => {
                  const vo = (v || {}) as {
                    id?: string; name?: string; image_url?: string | null;
                    price?: number | null; moq?: number | null; weight?: number | null;
                    volume?: number | null; dimensions?: string | null; capacity?: string | null;
                  };
                  return {
                    id: vo.id || '',
                    name: sanitizeForPublic(vo.name),
                    price: vo.price != null ? vo.price * (1 + margin / 100) : null,
                    moq: vo.moq ?? null,
                    weight: vo.weight ?? null,
                    volume: vo.volume ?? null,
                    dimensions: vo.dimensions ?? null,
                    capacity: vo.capacity ?? null,
                    image_url: (vo as { image_url?: string | null }).image_url ?? null,
                  };
                })
                .filter((v) => v.name)
            : null;

          // Prix d'affichage « à partir de » : plus petit prix POSITIF réel disponible
          // (produit, palier ou variante). Sur 1688 le prix existe toujours ; une absence
          // totale = défaut de collecte → from_price = 0 → produit filtré ci-dessous.
          const candidates: number[] = [];
          if (priceWithMargin != null && priceWithMargin > 0) candidates.push(priceWithMargin);
          for (const t of priceTiers || []) if (t.price > 0) candidates.push(t.price);
          for (const v of mappedVariants || []) if (v.price != null && v.price > 0) candidates.push(v.price);
          const fromPrice = candidates.length ? Math.min(...candidates) : 0;
          // Prix à 0 (aucun prix positif) → publié « Sur devis » (choix admin).
          const onQuote = fromPrice === 0;

          return {
            id: p.id,
            title: sanitizeForPublic(p.title),
            title_original: null, // never expose the source-language title to the customer
            description: sanitizeForPublic(p.description) || null,
            image_url: p.main_image_url || p.image_url,
            thumbnail_url: p.image_url,
            gallery,
            detail_images: detailImages,
            videos: Array.isArray(p.videos)
              ? p.videos.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
              : [],
            price: onQuote ? null : priceWithMargin,
            from_price: fromPrice,
            on_quote: onQuote, // true → afficher « Sur devis » côté client
            price_tiers: priceTiers && priceTiers.length ? priceTiers : null,
            variants_total: typeof p.variants_total === 'number' ? p.variants_total : null,
            moq: p.moq,
            weight: p.weight,
            volume: p.volume,
            dimensions: p.dimensions,
            dimensions_cm: p.dimensions_cm,
            has_battery: !!p.has_battery,
            info_manquante: sanitizeForPublic(p.info_manquante) || null,
            seller: null, // hide supplier name from the public offer
            product_url: '',
            variants: mappedVariants,
          };
        }),
      // Les produits « sur devis » (prix 0) sont conservés et publiés.
    }))
    .filter((item) => item.products.length > 0);

  return {
    offer: {
      id: offer.id,
      title: sanitizeForPublic(offer.title),
      theme: sanitizeForPublic(offer.theme) || null,
      description: sanitizeForPublic(offer.description) || null,
      cover_image_url: offer.cover_image_url,
      cover_video_url: (offer as { cover_video_url?: string | null }).cover_video_url || null,
      mobile_video_url: (offer as { mobile_video_url?: string | null }).mobile_video_url || null,
      note: sanitizeForPublic((offer as { note?: string | null }).note) || null,
      currency: ((offer as { offer_currency?: string }).offer_currency as 'CNY' | 'USD' | 'EUR' | 'XAF') || 'XAF',
      offer_type: ((offer as { offer_type?: string }).offer_type as 'b2c' | 'b2b') || 'b2c',
    },
    phases,
    items: publicItems,
  };
}
