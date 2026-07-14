import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

// POST: copie des produits d'une AUTRE offre dans l'offre courante.
// Body: { source_product_ids: string[], target_item_id?: string }
// - target_item_id : catégorie (offer_item) de destination dans l'offre courante.
//   Si absent, une catégorie « Produits importés » est créée/réutilisée.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    source_product_ids?: string[];
    target_item_id?: string;
  };
  const ids = Array.isArray(body.source_product_ids) ? body.source_product_ids.filter(Boolean) : [];
  if (!ids.length) {
    return NextResponse.json({ error: 'Aucun produit sélectionné' }, { status: 400 });
  }

  // Vérifie l'offre courante.
  const { data: offer } = await supabaseAdmin.from('offers').select('id').eq('id', uuid).single();
  if (!offer) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

  // Détermine la catégorie de destination.
  let targetItemId = body.target_item_id || null;
  if (targetItemId) {
    const { data: item } = await supabaseAdmin
      .from('offer_items')
      .select('id')
      .eq('id', targetItemId)
      .eq('offer_id', uuid)
      .single();
    if (!item) targetItemId = null;
  }
  if (!targetItemId) {
    // Réutilise ou crée « Produits importés ».
    const { data: existing } = await supabaseAdmin
      .from('offer_items')
      .select('id')
      .eq('offer_id', uuid)
      .eq('description', 'Produits importés')
      .maybeSingle();
    if (existing) {
      targetItemId = existing.id;
    } else {
      const { data: maxPos } = await supabaseAdmin
        .from('offer_items')
        .select('position')
        .eq('offer_id', uuid)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: created, error: createErr } = await supabaseAdmin
        .from('offer_items')
        .insert({
          offer_id: uuid,
          description: 'Produits importés',
          processed: true,
          added_by: 'admin',
          position: (maxPos?.position ?? -1) + 1,
        })
        .select('id')
        .single();
      if (createErr || !created) {
        return NextResponse.json({ error: createErr?.message || 'Erreur catégorie' }, { status: 500 });
      }
      targetItemId = created.id;
    }
  }

  // Charge les produits source (toutes colonnes).
  const { data: sources } = await supabaseAdmin
    .from('offer_products')
    .select('*')
    .in('id', ids);
  if (!sources?.length) {
    return NextResponse.json({ error: 'Produits source introuvables' }, { status: 404 });
  }

  // Position de départ dans la catégorie cible.
  const { data: lastProd } = await supabaseAdmin
    .from('offer_products')
    .select('position')
    .eq('offer_item_id', targetItemId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = ((lastProd?.position as number) ?? -1) + 1;

  // Colonnes à NE PAS copier telles quelles.
  const OMIT = new Set(['id', 'offer_item_id', 'created_at', 'position', 'review_state']);
  const rows = (sources as Record<string, unknown>[]).map((p) => {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) if (!OMIT.has(k)) row[k] = v;
    row.offer_item_id = targetItemId;
    row.position = pos++;
    row.selected = true;
    return row;
  });

  const { error: insErr } = await supabaseAdmin.from('offer_products').insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await logCollabAction(actor, {
    action: 'import_products',
    target_type: 'offer',
    target_id: uuid,
    description: `Import de ${rows.length} produit(s) depuis une autre offre`,
  });

  return NextResponse.json({ success: true, inserted: rows.length, target_item_id: targetItemId });
}
