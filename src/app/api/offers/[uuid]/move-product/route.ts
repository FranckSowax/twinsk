import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

// POST: deplace un offer_product d une categorie (offer_item) a une autre
// au sein de la meme offre. Utilise par le drag & drop sur /admin/offer.
// Body : { productId: string, toItemId: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid: moveUuid } = await params;
  await logCollabAction(actor, { action: 'move_product', target_type: 'offer', target_id: moveUuid, description: 'Produit déplacé entre catégories' });

  try {
    const { uuid } = await params;
    const body = (await request.json()) as { productId?: unknown; toItemId?: unknown };
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const toItemId = typeof body.toItemId === 'string' ? body.toItemId : '';
    if (!productId || !toItemId) {
      return NextResponse.json({ error: 'productId et toItemId requis' }, { status: 400 });
    }

    // Verifie que la categorie cible appartient bien a cette offre.
    const { data: targetItem, error: itemErr } = await supabaseAdmin
      .from('offer_items')
      .select('id, offer_id')
      .eq('id', toItemId)
      .single();
    if (itemErr || !targetItem) {
      return NextResponse.json({ error: 'Catégorie cible introuvable' }, { status: 404 });
    }
    if (targetItem.offer_id !== uuid) {
      return NextResponse.json({ error: 'Catégorie hors de cette offre' }, { status: 403 });
    }

    // Verifie que le produit appartient deja a une categorie de cette offre.
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('offer_products')
      .select('id, offer_item_id, offer_items!inner(offer_id)')
      .eq('id', productId)
      .single();
    if (prodErr || !product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }
    const currentOfferId = (product as unknown as { offer_items: { offer_id: string } }).offer_items.offer_id;
    if (currentOfferId !== uuid) {
      return NextResponse.json({ error: 'Produit hors de cette offre' }, { status: 403 });
    }

    if (product.offer_item_id === toItemId) {
      return NextResponse.json({ success: true, unchanged: true });
    }

    const { error: updErr } = await supabaseAdmin
      .from('offer_products')
      .update({ offer_item_id: toItemId })
      .eq('id', productId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('move-product error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
