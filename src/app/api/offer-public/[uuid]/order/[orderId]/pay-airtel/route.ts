import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOrdersGroup } from '@/lib/order-notify';

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

  // Coordonnées client OBLIGATOIRES avant toute finalisation.
  const { data: existing } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_name, client_phone')
    .eq('id', orderId)
    .eq('offer_id', uuid)
    .single();
  if (!existing) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }
  if (!existing.client_name?.trim() || !existing.client_phone?.trim()) {
    return NextResponse.json(
      { error: 'Renseignez vos coordonnées (nom + WhatsApp) avant de finaliser' },
      { status: 400 },
    );
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

  // Récap détaillé (produits + liens 1688) dans le groupe 🧾 Commandes Oh My Gab.
  await notifyOrdersGroup(orderId, request.nextUrl.origin);

  return NextResponse.json({ success: true });
}
