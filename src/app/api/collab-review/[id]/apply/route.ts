import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

// POST: réapplique les infos complétées par le collaborateur au produit de l'offre
// (admin only). Ne touche que les champs renseignés dans la ligne révisée.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const { data: line } = await supabaseAdmin
    .from('collab_review_lines')
    .select('offer_product_id, price, weight, volume, dimensions, supplier_shipping_price, delivery_time, has_battery, moq, variants')
    .eq('id', id)
    .single();
  if (!line) return NextResponse.json({ error: 'Ligne introuvable' }, { status: 404 });
  if (!line.offer_product_id) {
    return NextResponse.json({ error: 'Produit source supprimé — impossible d’appliquer' }, { status: 400 });
  }

  // N'écrase que les champs non-nuls fournis par le collaborateur.
  const patch: Record<string, unknown> = {};
  for (const f of ['price', 'weight', 'volume', 'dimensions', 'supplier_shipping_price', 'delivery_time', 'has_battery', 'moq'] as const) {
    if (line[f] != null) patch[f] = line[f];
  }
  // Variantes : fusionne poids/volume/dimensions collectés (par index) dans le produit.
  if (Array.isArray(line.variants)) {
    const { data: prod } = await supabaseAdmin
      .from('offer_products')
      .select('variants')
      .eq('id', line.offer_product_id)
      .single();
    const prodVariants = Array.isArray(prod?.variants) ? [...(prod!.variants as Record<string, unknown>[])] : [];
    (line.variants as Record<string, unknown>[]).forEach((rv, i) => {
      if (i >= prodVariants.length) return;
      const upd: Record<string, unknown> = { ...(prodVariants[i] || {}) };
      if (rv.weight != null) upd.weight = rv.weight;
      if (rv.volume != null) upd.volume = rv.volume;
      if (rv.dimensions != null && rv.dimensions !== '') upd.dimensions = rv.dimensions;
      prodVariants[i] = upd;
    });
    patch.variants = prodVariants;
  }
  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin.from('offer_products').update(patch).eq('id', line.offer_product_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin
    .from('collab_review_lines')
    .update({ applied_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ success: true, applied: Object.keys(patch) });
}
