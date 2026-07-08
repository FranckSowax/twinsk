import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: le client déclare un paiement Airtel Money en joignant la capture d'écran.
// La commande passe en "submitted" (en attente de vérification par l'admin).
// Body: { proof_url: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  const { uuid, orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as { proof_url?: string };
  const proofUrl = (body.proof_url || '').trim();
  if (!proofUrl) {
    return NextResponse.json({ error: 'Capture d’écran requise' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('offer_orders')
    .update({
      payment_method: 'airtel',
      payment_proof_url: proofUrl,
      payment_status: 'submitted',
    })
    .eq('id', orderId)
    .eq('offer_id', uuid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
