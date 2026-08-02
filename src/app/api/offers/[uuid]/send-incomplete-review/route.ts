import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

// POST: envoie en révision (collab_review_lines) chaque produit de l'offre dont le
// poids OU le volume manque — au niveau variante (strict), sinon au niveau produit.
// Chaque fiche part avec ses variantes à compléter (dropdown côté /admin/revisions).
// Anti-doublon : une fiche déjà « pending » n'est pas recréée.
export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;

  const { data: offer } = await supabaseAdmin.from('offers').select('title').eq('id', uuid).single();

  // Produits de l'offre (via offer_items).
  const { data: prods, error } = await supabaseAdmin
    .from('offer_products')
    .select(
      'id, title, title_original, image_url, main_image_url, product_url, seller, variants, price, weight, volume, dimensions, supplier_shipping_price, delivery_time, has_battery, moq, offer_items!inner(offer_id)',
    )
    .eq('offer_items.offer_id', uuid)
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pos = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  };
  type V = { weight?: unknown; volume?: unknown };
  // Incomplet = au moins un emplacement (variante, sinon produit) sans poids OU sans volume.
  const isIncomplete = (p: { weight?: unknown; volume?: unknown; variants?: unknown }): boolean => {
    const vs = Array.isArray(p.variants) ? (p.variants as V[]) : [];
    if (vs.length) return vs.some((v) => !pos(v.weight) || !pos(v.volume));
    return !pos(p.weight) || !pos(p.volume);
  };

  const targets = (prods || []).filter(isIncomplete);

  // Fiches déjà en attente pour ces produits → ne pas dupliquer.
  const ids = targets.map((p) => p.id);
  const { data: existing } = ids.length
    ? await supabaseAdmin
        .from('collab_review_lines')
        .select('offer_product_id')
        .in('offer_product_id', ids)
        .eq('review_status', 'pending')
    : { data: [] as { offer_product_id: string }[] };
  const dejaEnvoye = new Set((existing || []).map((e) => e.offer_product_id));

  let created = 0;
  let skipped = dejaEnvoye.size;
  for (const p of targets) {
    if (dejaEnvoye.has(p.id)) continue;
    const row: Record<string, unknown> = {
      offer_id: uuid,
      offer_product_id: p.id,
      offer_title: offer?.title || null,
      title: p.title,
      title_original: p.title_original || null,
      image_url: p.main_image_url || p.image_url || null,
      product_url: p.product_url || null,
      seller: p.seller || null,
      variants: p.variants || null,
      price: p.price,
      weight: p.weight,
      volume: p.volume,
      dimensions: p.dimensions,
      supplier_shipping_price: p.supplier_shipping_price,
      delivery_time: p.delivery_time,
      has_battery: p.has_battery,
      moq: p.moq,
      review_status: 'pending',
    };
    // Résilient : réessai sans title_original si la migration 45 n'est pas appliquée.
    let ins = await supabaseAdmin.from('collab_review_lines').insert(row);
    if (ins.error) {
      const { title_original: _t, ...rest } = row;
      void _t;
      ins = await supabaseAdmin.from('collab_review_lines').insert(rest);
    }
    if (!ins.error) created++;
  }

  return NextResponse.json({ success: true, incomplets: targets.length, created, skipped });
}
