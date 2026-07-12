import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

// POST: l'admin valide la révision d'un produit depuis /admin/offer.
// Applique les infos complétées par le collaborateur au produit, puis repasse
// la ligne en normal (review_state = null). Admin only.
// Body: { product_id }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  await params; // uuid non utilisé (product_id suffit)
  const body = (await request.json().catch(() => ({}))) as { product_id?: string };
  if (!body.product_id) {
    return NextResponse.json({ error: 'product_id requis' }, { status: 400 });
  }

  // Dernière ligne révisée non appliquée pour ce produit.
  const { data: line } = await supabaseAdmin
    .from('collab_review_lines')
    .select('id, price, weight, volume, dimensions, supplier_shipping_price, delivery_time, has_battery, moq')
    .eq('offer_product_id', body.product_id)
    .eq('review_status', 'reviewed')
    .is('applied_at', null)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Applique les champs complétés (non-nuls) au produit d'offre.
  if (line) {
    const patch: Record<string, unknown> = {};
    for (const f of ['price', 'weight', 'volume', 'dimensions', 'supplier_shipping_price', 'delivery_time', 'has_battery', 'moq'] as const) {
      if (line[f] != null) patch[f] = line[f];
    }
    if (Object.keys(patch).length) {
      await supabaseAdmin.from('offer_products').update(patch).eq('id', body.product_id);
    }
    await supabaseAdmin
      .from('collab_review_lines')
      .update({ applied_at: new Date().toISOString() })
      .eq('id', line.id);
  }

  // Repasse la ligne en normal.
  await supabaseAdmin
    .from('offer_products')
    .update({ review_state: null })
    .eq('id', body.product_id);

  return NextResponse.json({ success: true });
}
