// Enregistrement idempotent d'un paiement en ligne et validation de la commande.
// Appelé par l'IPN de l'agrégateur ET au retour du client sur sa commande :
// les deux peuvent arriver dans n'importe quel ordre, plusieurs fois.
//   - payments : une ligne par facture (unique provider + provider_ref) ;
//     un statut « completed » n'est jamais rétrogradé.
//   - offer_orders : passage à « paid » conditionnel (payment_status ≠ 'paid'),
//     donc une seule notification client et groupe, quel que soit le nombre d'appels.

import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyClientOrderStatus } from '@/lib/order-status-notify';
import { notifyOrdersGroup } from '@/lib/order-notify';
import type { PaymentMethodId } from './methods';
import type { PaydunyaStatus } from './paydunya';

export interface ProviderPaymentUpdate {
  provider: PaymentMethodId;
  providerRef: string;
  status: PaydunyaStatus;
  /** Montant confirmé par le prestataire (FCFA). */
  paidAmount: number;
  receiptUrl?: string | null;
  raw?: unknown;
}

export type SettleOutcome =
  | { result: 'unknown_reference' }
  | { result: 'amount_mismatch'; expected: number; paid: number }
  | { result: 'recorded'; status: PaydunyaStatus; orderId: string | null; newlyPaid: boolean };

export async function settleProviderPayment(u: ProviderPaymentUpdate, origin: string): Promise<SettleOutcome> {
  const { data: pay } = await supabaseAdmin
    .from('payments')
    .select('id, order_id, amount, status')
    .eq('provider', u.provider)
    .eq('provider_ref', u.providerRef)
    .maybeSingle();
  // Référence inconnue : jamais créée par nous → ignorée (pas d'insertion à l'aveugle).
  if (!pay) return { result: 'unknown_reference' };

  const expected = Math.round(Number(pay.amount) || 0);
  let status = u.status;
  if (status === 'completed' && Math.round(u.paidAmount) < expected) {
    // Montant payé inférieur à la facture : on n'enregistre pas le paiement comme acquis.
    await supabaseAdmin.from('payments').update({ raw: u.raw ?? null, updated_at: new Date().toISOString() }).eq('id', pay.id);
    return { result: 'amount_mismatch', expected, paid: u.paidAmount };
  }
  if (pay.status === 'completed') status = 'completed';

  await supabaseAdmin
    .from('payments')
    .update({ status, receipt_url: u.receiptUrl ?? null, raw: u.raw ?? null, updated_at: new Date().toISOString() })
    .eq('id', pay.id)
    .neq('status', 'completed');

  let newlyPaid = false;
  if (status === 'completed' && pay.order_id) {
    const { data: order } = await supabaseAdmin.from('offer_orders').select('order_status').eq('id', pay.order_id).single();
    const nextStatus = !order?.order_status || order.order_status === 'unpaid' ? 'paid' : order.order_status;
    const { data: updated } = await supabaseAdmin
      .from('offer_orders')
      .update({ payment_status: 'paid', payment_method: u.provider, order_status: nextStatus })
      .eq('id', pay.order_id)
      .neq('payment_status', 'paid')
      .select('id');
    newlyPaid = !!updated?.length;
    if (newlyPaid) {
      await notifyClientOrderStatus({ orderId: pay.order_id, status: 'paid', origin, actor: `provider:${u.provider}` });
      await notifyOrdersGroup(pay.order_id, origin);
    }
  }
  return { result: 'recorded', status, orderId: pay.order_id, newlyPaid };
}
