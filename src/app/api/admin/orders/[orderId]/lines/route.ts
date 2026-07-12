import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { recomputeOrder } from '@/lib/admin-order';

// POST: ajouter une ligne (produit) à une commande (admin).
// Body: { product_title, unit_price_cny, quantity, weight?, volume?, has_battery?, product_image?, product_url? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    product_title?: string;
    unit_price_cny?: number;
    quantity?: number;
    weight?: number | null;
    volume?: number | null;
    has_battery?: boolean;
    product_image?: string | null;
    product_url?: string | null;
  };

  const title = (body.product_title || '').trim();
  if (!title) return NextResponse.json({ error: 'Nom du produit requis' }, { status: 400 });
  const unit = Number(body.unit_price_cny) || 0;
  const qty = Math.max(1, Math.trunc(Number(body.quantity) || 1));

  const { error } = await supabaseAdmin.from('offer_order_lines').insert({
    order_id: orderId,
    product_id: null,
    product_title: title,
    product_image: body.product_image || null,
    product_url: body.product_url || null,
    unit_price_cny: unit,
    quantity: qty,
    subtotal_cny: unit * qty,
    weight: body.weight ?? null,
    volume: body.volume ?? null,
    has_battery: body.has_battery ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = await recomputeOrder(orderId);
  return NextResponse.json({ success: true, totals });
}
