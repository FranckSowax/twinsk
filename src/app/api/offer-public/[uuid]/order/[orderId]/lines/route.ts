import { NextRequest, NextResponse } from 'next/server';
import { addProductToOrder, loadEditableOrder } from '@/lib/offer-order-lines-edit';

// POST : ajoute un produit au panier d'une commande non payée.
// Body: { product_id, variant_id?, quantity? } — même produit + même variante
// déjà présents → la quantité s'additionne.
export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string; orderId: string }> }) {
  const { uuid, orderId } = await params;
  const order = await loadEditableOrder(uuid, orderId);
  if ('error' in order) return NextResponse.json({ error: order.error }, { status: order.status });
  const body = (await request.json().catch(() => ({}))) as { product_id?: string; variant_id?: string | null; quantity?: number };
  if (!body.product_id) return NextResponse.json({ error: 'Produit requis' }, { status: 400 });
  const r = await addProductToOrder(order, { product_id: body.product_id, variant_id: body.variant_id || null, quantity: body.quantity });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, promo_removed: r.promo_removed, lines: r.lines });
}
