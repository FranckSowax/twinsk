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
    .from('offer_orders').select('id, client_name, client_phone, order_status').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const from = (order.order_status || 'unpaid') as AgentOrderStatus;
  if (!canAdvanceTo(from, 'at_agency')) return NextResponse.json({ error: 'Transition invalide' }, { status: 409 });
  await supabaseAdmin.from('offer_orders').update({ order_status: 'at_agency' }).eq('id', id);
  await logAgentAction(agent.id, id, 'receive', {});
  await notifyClient(
    order.client_phone,
    `🎉 Bonne nouvelle ${order.client_name || ''} ! Votre colis (${orderNumber(id)}) est *arrivé à l'agence TWINSK*. Venez le retirer.`,
  );
  return NextResponse.json({ success: true, order_status: 'at_agency' });
}
