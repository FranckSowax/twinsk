// Helpers partagés par les 5 routes d'action agent (DRY) : audit + notif client.
import { supabaseAdmin } from './supabase/server';
import { sendWhapiText } from './whapi';
import { toWhatsappChatId } from './order-number';

export async function logAgentAction(
  agentId: string, orderId: string, action: string, meta?: Record<string, unknown>,
): Promise<void> {
  await supabaseAdmin.from('agent_actions').insert({
    agent_id: agentId, order_id: orderId, action, meta: meta ?? null,
  });
}

export async function notifyClient(
  clientPhone: string | null | undefined, text: string,
): Promise<void> {
  const chat = toWhatsappChatId(clientPhone);
  if (!chat) return;
  try {
    await sendWhapiText(text, chat);
  } catch {
    // best-effort
  }
}
