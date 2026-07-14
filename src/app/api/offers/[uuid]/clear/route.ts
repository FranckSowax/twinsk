import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

// POST: vide le contenu d'une offre (supprime toutes les catégories + produits
// générés, y compris via JSON) tout en GARDANT l'offre (titre, thème, cover…).
// Le cascade DB retire les offer_products. Les commandes restent (product_id → null).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;

  const { data: offer } = await supabaseAdmin.from('offers').select('id').eq('id', uuid).single();
  if (!offer) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

  // Supprime toutes les catégories de l'offre → cascade sur les produits.
  const { error } = await supabaseAdmin.from('offer_items').delete().eq('offer_id', uuid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCollabAction(actor, {
    action: 'clear_offer',
    target_type: 'offer',
    target_id: uuid,
    description: 'Offre vidée (toutes les lignes produits supprimées)',
  });

  return NextResponse.json({ success: true });
}
