import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

const FIELD_LABELS: Record<string, string> = {
  dimensions: 'Dimensions', weight: 'Poids', volume: 'Volume', price: 'Prix', moq: 'MOQ',
  quantity: 'Quantité', margin_percent: 'Marge', title: 'Titre', description: 'Description',
  seller: 'Vendeur', variants: 'Variantes', has_battery: 'Batterie', selected: 'Sélection',
};

// GET: Get all search results for a request
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

    // Get all request items with their search results
    const { data, error } = await supabaseAdmin
      .from('request_items')
      .select('*, search_results(*), item_notes(*)')
      .eq('request_id', uuid)
      .order('created_at');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH: Update search results (select, quantity, margin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { uuid } = await params;

    const { updates } = await request.json();

    if (!updates?.length) {
      return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 });
    }

    const changedFields = new Set<string>();
    for (const update of updates) {
      const { id, ...fields } = update;
      Object.keys(fields).forEach((k) => changedFields.add(k));
      await supabaseAdmin
        .from('search_results')
        .update(fields)
        .eq('id', id);
    }

    const labels = [...changedFields].filter((f) => f !== 'selected').map((f) => FIELD_LABELS[f] || f);
    if (labels.length) {
      await logCollabAction(actor, {
        action: 'update_product',
        target_type: 'request',
        target_id: uuid,
        description: `Fiche(s) mise(s) à jour : ${labels.join(', ')}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
