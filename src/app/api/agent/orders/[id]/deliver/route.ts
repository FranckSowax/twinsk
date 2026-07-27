import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent, canAdvanceTo, AgentOrderStatus } from '@/lib/agent';
import { logAgentAction, notifyClient } from '@/lib/agent-actions';
import { orderNumber } from '@/lib/order-number';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { data: order } = await supabaseAdmin
    .from('offer_orders').select('id, client_phone, order_status').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const from = (order.order_status || 'unpaid') as AgentOrderStatus;
  if (!canAdvanceTo(from, 'delivered')) return NextResponse.json({ error: 'Transition invalide' }, { status: 409 });
  await supabaseAdmin.from('offer_orders').update({ order_status: 'delivered' }).eq('id', id);
  await logAgentAction(agent.id, id, 'deliver', {});
  await notifyClient(order.client_phone, `🤝 Votre commande ${orderNumber(id)} vous a été *remise*. Merci de votre confiance !`);
  return NextResponse.json({ success: true, order_status: 'delivered' });
}
