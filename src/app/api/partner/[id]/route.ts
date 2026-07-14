import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Espace partenaire (marque blanche). L'UUID du lien (affiliate_offers.id) sert
// de jeton d'accès — même modèle que /fiche/[id].

interface AffiliateRow {
  id: string;
  shop_name: string;
  airtel_number: string | null;
  whatsapp_number: string | null;
  active: boolean;
}

async function loadLink(id: string) {
  const { data } = await supabaseAdmin
    .from('affiliate_offers')
    .select('id, offer_id, commission_percent, hidden_product_ids, item_order, active, affiliates(id, shop_name, airtel_number, whatsapp_number, active)')
    .eq('id', id)
    .single();
  if (!data) return null;
  return { ...data, affiliate: data.affiliates as unknown as AffiliateRow | null };
}

// GET: données du partenaire — profil, réglages, produits de l'offre, KPIs.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await loadLink(id);
  if (!link || !link.affiliate) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });

  const { data: offer } = await supabaseAdmin
    .from('offers')
    .select('id, title, status')
    .eq('id', link.offer_id)
    .single();

  // Produits (pour masquer/réordonner) — champs minimaux.
  const { data: itemRows } = await supabaseAdmin
    .from('offer_items')
    .select('id, description, position, offer_products(id, title, image_url, main_image_url, price)')
    .eq('offer_id', link.offer_id)
    .order('position');
  const items = (itemRows || []).map((it) => ({
    id: it.id,
    description: it.description,
    products: ((it.offer_products || []) as { id: string; title: string; image_url: string; main_image_url: string | null; price: number | null }[]).map((p) => ({
      id: p.id,
      title: p.title,
      image_url: p.main_image_url || p.image_url,
      price: p.price,
    })),
  }));

  // KPIs sur les ventes de cet affilié (toutes offres confondues).
  const { data: orders } = await supabaseAdmin
    .from('offer_orders')
    .select('id, offer_id, client_name, grand_total_fcfa, items_total_fcfa, commission_fcfa, payment_status, order_status, status, created_at')
    .eq('affiliate_id', link.affiliate.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const list = orders || [];
  const kpis = {
    orders: list.length,
    revenue_fcfa: list.reduce((s, o) => s + (Number(o.grand_total_fcfa ?? o.items_total_fcfa) || 0), 0),
    commission_fcfa: list.reduce((s, o) => s + (Number(o.commission_fcfa) || 0), 0),
    paid: list.filter((o) => o.payment_status === 'paid').length,
  };

  return NextResponse.json({
    id: link.id,
    offer: offer || null,
    shop_name: link.affiliate.shop_name,
    airtel_number: link.affiliate.airtel_number,
    whatsapp_number: link.affiliate.whatsapp_number,
    commission_percent: Number(link.commission_percent) || 0,
    hidden_product_ids: Array.isArray(link.hidden_product_ids) ? link.hidden_product_ids : [],
    item_order: Array.isArray(link.item_order) ? link.item_order : null,
    active: link.active,
    items,
    kpis,
    recent_orders: list.slice(0, 10),
  });
}

// PATCH: le partenaire édite sa boutique et les réglages de son offre.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await loadLink(id);
  if (!link || !link.affiliate) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Profil boutique.
  const profile: Record<string, unknown> = {};
  if (typeof body.shop_name === 'string') profile.shop_name = body.shop_name.trim().slice(0, 80);
  if (typeof body.airtel_number === 'string') profile.airtel_number = body.airtel_number.trim() || null;
  if (typeof body.whatsapp_number === 'string') profile.whatsapp_number = body.whatsapp_number.trim() || null;
  if (Object.keys(profile).length) {
    const { error } = await supabaseAdmin.from('affiliates').update(profile).eq('id', link.affiliate.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Réglages de l'offre marque blanche.
  const settings: Record<string, unknown> = {};
  if (body.commission_percent !== undefined) {
    const c = Number(body.commission_percent);
    if (!Number.isFinite(c) || c < 0 || c > 100) {
      return NextResponse.json({ error: 'Commission invalide (0–100)' }, { status: 400 });
    }
    settings.commission_percent = c;
  }
  if (Array.isArray(body.hidden_product_ids)) {
    settings.hidden_product_ids = body.hidden_product_ids.filter((v) => typeof v === 'string');
  }
  if (Array.isArray(body.item_order)) {
    settings.item_order = body.item_order.filter((v) => typeof v === 'string');
  }
  if (Object.keys(settings).length) {
    const { error } = await supabaseAdmin.from('affiliate_offers').update(settings).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
