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
    .select('id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, payment_status, order_status')
    .eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ error: 'Déjà payée' }, { status: 409 });

  const nextStatus = order.order_status === 'unpaid' || !order.order_status ? 'paid' : order.order_status;
  const amount = Number(order.grand_total_fcfa ?? order.items_total_fcfa) || 0;
  const { error: updErr } = await supabaseAdmin.from('offer_orders').update({
    payment_status: 'paid', payment_method: 'cash', order_status: nextStatus,
    cash_collected_by: agent.id, cash_collected_at: new Date().toISOString(),
  }).eq('id', id);
  if (updErr) return NextResponse.json({ error: 'Échec mise à jour' }, { status: 500 });

  await logAgentAction(agent.id, id, 'collect_cash', { amount_fcfa: amount });
  await notifyClient(
    order.client_phone,
    `✅ *Paiement reçu* — Commande ${orderNumber(id)}\nNous avons bien encaissé ${Math.round(amount).toLocaleString('fr-FR')} FCFA. Merci !`,
  );
  return NextResponse.json({ success: true, order_status: nextStatus });
}
