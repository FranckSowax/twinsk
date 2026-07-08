import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

// PATCH: valider ou rejeter le paiement d'une commande (admin).
// Body: { payment_status: 'paid' | 'pending' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as { payment_status?: string };
  const status = body.payment_status;
  if (status !== 'paid' && status !== 'pending') {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }
  const patch: Record<string, unknown> = { payment_status: status };
  if (status === 'paid') patch.status = 'paid';
  const { error } = await supabaseAdmin.from('offer_orders').update(patch).eq('id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
