import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: le client choisit de payer CASH en agence. La commande passe en
// "submitted" (réservée, en attente de l'encaissement/validation par l'admin).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  const { uuid, orderId } = await params;

  const { error } = await supabaseAdmin
    .from('offer_orders')
    .update({
      payment_method: 'cash',
      payment_status: 'submitted',
    })
    .eq('id', orderId)
    .eq('offer_id', uuid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
