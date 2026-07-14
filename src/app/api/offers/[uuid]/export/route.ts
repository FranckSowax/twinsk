import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';

// GET: exporte une offre en JSON RÉIMPORTABLE (même schéma que le bulk-load).
// Permet de reproduire la page dans une autre offre (copier / télécharger).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;

  const { data: offer } = await supabaseAdmin
    .from('offers')
    .select('id, title, theme, description, offer_currency, offer_type, marche_cible, tri, mode, note, quality')
    .eq('id', uuid)
    .single();
  if (!offer) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

  const { data: items } = await supabaseAdmin
    .from('offer_items')
    .select('id, image_url, description, position, offer_products(*)')
    .eq('offer_id', uuid)
    .order('position');

  const clean = <T,>(v: T): T | undefined => (v == null ? undefined : v);
  const arr = (v: unknown) => (Array.isArray(v) && v.length ? v : undefined);

  const categories = (items || []).map((it) => {
    const products = ((it.offer_products || []) as Record<string, unknown>[])
      // ordre stable dans la catégorie
      .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
      .map((p) => ({
        title: p.title || '',
        title_original: clean(p.title_original as string | null),
        description: clean(p.description as string | null),
        description_admin: clean(p.description_admin as string | null),
        price: p.price ?? null,
        image_url: (p.main_image_url as string) || (p.image_url as string) || undefined,
        extra_images: arr(p.extra_images),
        videos: arr(p.videos),
        product_url: clean(p.product_url as string | null),
        seller: clean(p.seller as string | null),
        moq: clean(p.moq as number | null),
        weight: clean(p.weight as number | null),
        volume: clean(p.volume as number | null),
        dimensions: clean(p.dimensions as string | null),
        has_battery: !!p.has_battery,
        variants: arr(p.variants),
        // Champs catalogue v3.1
        price_tiers: arr(p.price_tiers),
        detail_images: arr(p.detail_images),
        variants_total: clean(p.variants_total as number | null),
        // Champs INTERNES
        supplier_shipping_price: clean(p.supplier_shipping_price as number | null),
        delivery_time: clean(p.delivery_time as string | null),
      }));
    return {
      description: it.description || '',
      image_url: clean(it.image_url),
      products,
    };
  });

  const json = {
    meta: {
      name: offer.title,
      marche_cible: clean(offer.marche_cible),
      tri: clean(offer.tri),
      mode: clean(offer.mode),
      note: clean(offer.note),
      quality: clean(offer.quality),
    },
    // Réglages d'offre (à titre indicatif — non appliqués par le bulk-load).
    offer: {
      title: offer.title,
      theme: offer.theme,
      description: offer.description,
      currency: offer.offer_currency || 'XAF',
      type: offer.offer_type || 'b2c',
    },
    categories,
  };

  return NextResponse.json(json);
}
