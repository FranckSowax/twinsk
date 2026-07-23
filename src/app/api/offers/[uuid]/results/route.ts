import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';

// Libellés FR des champs modifiables (pour le journal d'audit).
const FIELD_LABELS: Record<string, string> = {
  dimensions: 'Dimensions',
  weight: 'Poids',
  volume: 'Volume',
  price: 'Prix',
  moq: 'MOQ',
  quantity: 'Quantité',
  margin_percent: 'Marge',
  title: 'Titre',
  description: 'Description',
  seller: 'Vendeur',
  variants: 'Variantes',
  has_battery: 'Batterie',
  selected: 'Sélection',
};

// GET: List items + products for an offer, shaped like /api/requests/[uuid]/results
// so the existing ResultsTable component can render unchanged.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;

  const { data, error } = await supabaseAdmin
    .from('offer_items')
    .select('*, offer_products(*)')
    .eq('offer_id', uuid)
    .order('position');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Rename offer_products -> search_results to match ResultsTable expectations.
  type RawItem = {
    id: string;
    image_url: string | null;
    description: string | null;
    processed: boolean;
    added_by: string;
    phase_id: string | null;
    offer_products: unknown[];
  };
  const mapped = (data as RawItem[]).map((it) => ({
    id: it.id,
    image_url: it.image_url,
    description: it.description,
    processed: it.processed,
    added_by: it.added_by,
    phase_id: it.phase_id ?? null,
    search_results: it.offer_products || [],
    item_notes: [],
  }));
  return NextResponse.json(mapped);
}

// PATCH: Batch update offer_products (selected / margin / qty / weight / volume / etc.)
// Body: { updates: [{ id, ...fields }] }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { uuid } = await params;

  const { updates } = await request.json();
  if (!Array.isArray(updates) || !updates.length) {
    return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 });
  }

  const changedFields = new Set<string>();
  for (const update of updates) {
    const { id, ...fields } = update;
    if (!id) continue;
    // Filter only known mutable fields to avoid accidental overwrites
    const allowed = [
      'selected',
      'title',
      'title_original',
      'description',
      'price',
      'image_url',
      'main_image_url',
      'extra_images',
      'variants',
      'seller',
      'product_url',
      'quantity',
      'margin_percent',
      'moq',
      'weight',
      'volume',
      'dimensions',
      'has_battery',
      'supplier_shipping_price',
      'delivery_time',
      'description_admin',
      'position',
      'in_cover_video',
    ];
    const clean: Record<string, unknown> = {};
    for (const k of allowed) if (k in fields) { clean[k] = fields[k]; changedFields.add(k); }
    if (!Object.keys(clean).length) continue;
    await supabaseAdmin.from('offer_products').update(clean).eq('id', id);
  }

  // Audit : journalise la mise à jour si l'auteur est un collaborateur.
  const labels = [...changedFields].filter((f) => f !== 'selected').map((f) => FIELD_LABELS[f] || f);
  if (labels.length) {
    await logCollabAction(actor, {
      action: 'update_product',
      target_type: 'offer',
      target_id: uuid,
      description: `Fiche(s) mise(s) à jour : ${labels.join(', ')}`,
    });
  }
  return NextResponse.json({ success: true });
}
