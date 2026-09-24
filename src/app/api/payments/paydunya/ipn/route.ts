import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/public-origin';
import { isPaymentMethodEnabled } from '@/lib/payments/methods';
import { confirmInvoice, paydunyaConfig, parseBracketForm, readInvoiceData, verifyIpnHash } from '@/lib/payments/paydunya';
import { settleProviderPayment } from '@/lib/payments/settle';

// IPN PayDunya (actions.callback_url). Corps x-www-form-urlencoded « data[...] ».
// 1. Signature : data[hash] doit valoir SHA-512(MasterKey), sinon 401.
// 2. Le statut faisant foi est redemandé à PayDunya (checkout-invoice/confirm) ;
//    à défaut, on retient celui de l'IPN signé.
// 3. Enregistrement idempotent (unique provider + provider_ref, commande payée une seule fois).
// Répond 200 dès que la notification est traitée ou reconnue comme sans objet.
export async function POST(request: NextRequest) {
  if (!isPaymentMethodEnabled('paydunya')) return NextResponse.json({ error: 'Indisponible' }, { status: 404 });
  const cfg = paydunyaConfig();
  if (!cfg) return NextResponse.json({ error: 'Paiement non configuré' }, { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const entries: [string, string][] = [];
  form.forEach((v, k) => { if (typeof v === 'string') entries.push([k, v]); });
  const data = (parseBracketForm(entries).data || {}) as Record<string, unknown>;

  if (!verifyIpnHash(typeof data.hash === 'string' ? data.hash : null, cfg.masterKey)) {
    console.warn('[paydunya-ipn] signature invalide');
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
  }

  const fromIpn = readInvoiceData(data);
  if (!fromIpn.token) return NextResponse.json({ error: 'Référence absente' }, { status: 400 });
  const confirmed = await confirmInvoice(cfg, fromIpn.token);
  const inv = confirmed ?? fromIpn;

  const out = await settleProviderPayment(
    { provider: 'paydunya', providerRef: inv.token || fromIpn.token, status: inv.status, paidAmount: inv.totalAmount, receiptUrl: inv.receiptUrl, raw: inv.raw },
    publicOrigin(request),
  );
  if (out.result !== 'recorded') console.warn('[paydunya-ipn]', out.result, fromIpn.token);
  return NextResponse.json({ ok: true, result: out.result });
}
