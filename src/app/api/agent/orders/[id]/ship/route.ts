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
    .from('offer_orders').select('id, client_phone, payment_status, order_status').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (order.payment_status !== 'paid') return NextResponse.json({ error: 'Commande non payée' }, { status: 409 });
  const from = (order.order_status || 'unpaid') as AgentOrderStatus;
  if (!canAdvanceTo(from, 'shipped')) return NextResponse.json({ error: 'Transition invalide' }, { status: 409 });
  await supabaseAdmin.from('offer_orders').update({ order_status: 'shipped' }).eq('id', id);
  await logAgentAction(agent.id, id, 'ship', {});
  await notifyClient(order.client_phone, `📦 Votre commande ${orderNumber(id)} a été *expédiée*. Suivi à venir.`);
  return NextResponse.json({ success: true, order_status: 'shipped' });
}
