import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent } from '@/lib/agent';
import { logAgentAction, notifyClient } from '@/lib/agent-actions';
import { orderNumber } from '@/lib/order-number';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_phone, payment_status, order_status')
    .eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ error: 'Déjà payée' }, { status: 409 });

  const nextStatus = order.order_status === 'unpaid' || !order.order_status ? 'paid' : order.order_status;
  await supabaseAdmin.from('offer_orders').update({
    payment_status: 'paid', order_status: nextStatus,
  }).eq('id', id);

  await logAgentAction(agent.id, id, 'validate_payment', {});
  await notifyClient(order.client_phone, `✅ Paiement validé — Commande ${orderNumber(id)}. Merci !`);
  return NextResponse.json({ success: true, order_status: nextStatus });
}
