import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin, resolveActor } from '@/lib/collab';

// GET: liste des lignes à réviser (admin + collaborateur production/commandes).
// ?status=pending|reviewed
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request, ['production', 'commandes']);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  let query = supabaseAdmin
    .from('collab_review_lines')
    .select('*')
    .order('review_status', { ascending: true }) // pending avant reviewed
    .order('created_at', { ascending: false })
    .limit(300);

  const status = request.nextUrl.searchParams.get('status');
  if (status === 'pending' || status === 'reviewed') {
    query = query.eq('review_status', status);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ lines: [], warning: error.message });

  // Enrichit les lignes sans titre chinois (créées avant la migration 45) depuis
  // le produit d'offre lié, pour l'affichage en chinois. Best-effort.
  const lines = (data || []) as Record<string, unknown>[];
  const missing = lines.filter((l) => !l.title_original && l.offer_product_id);
  if (missing.length) {
    const ids = Array.from(new Set(missing.map((l) => l.offer_product_id as string)));
    const { data: prods } = await supabaseAdmin
      .from('offer_products')
      .select('id, title_original')
      .in('id', ids);
    const map = new Map((prods || []).map((p) => [p.id as string, p.title_original as string | null]));
    for (const l of missing) l.title_original = map.get(l.offer_product_id as string) ?? null;
  }
  return NextResponse.json({ lines });
}

// POST: copier une ligne produit d'offre vers la file « à réviser » (admin only).
// Body: { offer_id, product_id, admin_note? }
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    offer_id?: string;
    product_id?: string;
    admin_note?: string;
  };
  if (!body.offer_id || !body.product_id) {
    return NextResponse.json({ error: 'offer_id et product_id requis' }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin
    .from('offer_products')
    .select(
      'id, title, title_original, image_url, main_image_url, product_url, seller, variants, price, weight, volume, dimensions, supplier_shipping_price, delivery_time, has_battery, moq',
    )
    .eq('id', body.product_id)
    .single();
  if (!product) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }

  const { data: offer } = await supabaseAdmin
    .from('offers')
    .select('title')
    .eq('id', body.offer_id)
    .single();

  // Anti-doublon : ne pas renvoyer une ligne déjà en attente pour ce produit.
  const { data: existing } = await supabaseAdmin
    .from('collab_review_lines')
    .select('id')
    .eq('offer_product_id', body.product_id)
    .eq('review_status', 'pending')
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ success: true, id: existing.id, duplicate: true });
  }

  const row: Record<string, unknown> = {
    offer_id: body.offer_id,
    offer_product_id: product.id,
    offer_title: offer?.title || null,
    title: product.title,
    title_original: product.title_original || null,
    image_url: product.main_image_url || product.image_url || null,
    product_url: product.product_url || null,
    seller: product.seller || null,
    variants: product.variants || null,
    price: product.price,
    weight: product.weight,
    volume: product.volume,
    dimensions: product.dimensions,
    supplier_shipping_price: product.supplier_shipping_price,
    delivery_time: product.delivery_time,
    has_battery: product.has_battery,
    moq: product.moq,
    admin_note: (body.admin_note || '').trim() || null,
    review_status: 'pending',
  };
  let ins = await supabaseAdmin.from('collab_review_lines').insert(row).select('id').single();
  // Résilient : si la colonne title_original manque encore (migration 45 non
  // appliquée), on réessaie sans elle plutôt que d'échouer l'envoi en révision.
  if (ins.error) {
    const { title_original: _omit, ...fallback } = row;
    void _omit;
    ins = await supabaseAdmin.from('collab_review_lines').insert(fallback).select('id').single();
  }
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: ins.data?.id });
}
