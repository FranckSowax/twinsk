import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { publicOrigin } from '@/lib/public-origin';
import { isPaymentMethodEnabled } from '@/lib/payments/methods';
import { confirmInvoice, paydunyaConfig } from '@/lib/payments/paydunya';
import { settleProviderPayment } from '@/lib/payments/settle';

// POST : au retour de la page de paiement, on demande à PayDunya le statut de la
// dernière facture de la commande. Filet de sécurité si l'IPN tarde ou se perd ;
// idempotent (lib/payments/settle.ts).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; orderId: string }> },
) {
  if (!isPaymentMethodEnabled('paydunya')) return NextResponse.json({ error: 'Indisponible' }, { status: 404 });
  const cfg = paydunyaConfig();
  if (!cfg) return NextResponse.json({ error: 'Paiement non configuré' }, { status: 503 });

  const { uuid, orderId } = await params;
  const { data: order } = await supabaseAdmin
    .from('offer_orders').select('id, payment_status').eq('id', orderId).eq('offer_id', uuid).single();
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ status: 'completed' });

  const { data: pay } = await supabaseAdmin
    .from('payments')
    .select('provider_ref')
    .eq('provider', 'paydunya')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pay) return NextResponse.json({ status: 'none' });

  const inv = await confirmInvoice(cfg, pay.provider_ref);
  if (!inv) return NextResponse.json({ status: 'pending' });
  const out = await settleProviderPayment(
    { provider: 'paydunya', providerRef: pay.provider_ref, status: inv.status, paidAmount: inv.totalAmount, receiptUrl: inv.receiptUrl, raw: inv.raw },
    publicOrigin(request),
  );
  return NextResponse.json({ status: out.result === 'recorded' ? out.status : out.result });
}
