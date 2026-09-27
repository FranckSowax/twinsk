import { NextRequest, NextResponse } from 'next/server';
import { addFromSelection } from '@/lib/client-selection';

// POST : « Ajouter au panier » depuis une sélection envoyée sur WhatsApp.
// Public : l'identifiant de sélection (uuid envoyé au seul client) sert de jeton.
// Body: { product_id } → { offer_id, order_id, added }.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { product_id?: string };
  if (!body.product_id) return NextResponse.json({ error: 'Produit requis' }, { status: 400 });
  const r = await addFromSelection(id, body.product_id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ offer_id: r.offerId, order_id: r.orderId, added: r.added });
}
