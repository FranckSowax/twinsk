import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { loadQuoteDocument, type QuoteSnapshot } from '@/lib/quote-data';
import { canConvertToInvoice, quoteKeys } from '@/lib/quote-documents';
import { quoteLinesTotal, resolveAllQuoteLines, type QuoteSourceResult } from '@/lib/variant-picks';

// POST : transforme un devis en facture (admin).
// - La facture est un nouveau document (document_type « facture ») dont le
//   contenu est FIGÉ : client, destination, produits, prix, quantités et mode
//   de transport sont copiés dans `quote_snapshot:<id>`.
// - Idempotent : un devis déjà transformé renvoie sa facture existante.
// - Le devis passe au statut « accepted ».
export async function POST(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { quoteId } = await params;

  const doc = await loadQuoteDocument(quoteId);
  if (!doc) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
  const q = doc.quote;
  if (!canConvertToInvoice(q.document_type)) {
    return NextResponse.json({ error: 'Seul un devis peut être transformé en facture' }, { status: 400 });
  }

  // Déjà transformé : on renvoie la facture existante (si elle existe encore).
  if (q.invoice_id) {
    const { data: existing } = await supabaseAdmin.from('quotes').select('id').eq('id', q.invoice_id).maybeSingle();
    if (existing) return NextResponse.json({ id: existing.id, existing: true });
  }

  if (!doc.request || !doc.items.length) {
    return NextResponse.json({ error: 'Aucun produit retenu : impossible de facturer' }, { status: 400 });
  }

  // Total des articles recalculé comme à la génération du devis (transport en sus, calculé à l'affichage).
  const results = doc.items.flatMap((i) => i.search_results || []);
  const lines = resolveAllQuoteLines(
    results.map((r) => ({ ...(r as unknown as QuoteSourceResult), margin_percent: r.margin_percent || q.margin_global || 0 })),
  );
  const totalAmount = Math.round(quoteLinesTotal(lines) * 100) / 100;

  const { data: invoice, error } = await supabaseAdmin
    .from('quotes')
    .insert({
      request_id: q.request_id,
      total_amount: totalAmount,
      margin_global: q.margin_global || 0,
      status: 'draft',
      document_type: 'facture',
    })
    .select('id')
    .single();
  if (error || !invoice) return NextResponse.json({ error: error?.message || 'Création impossible' }, { status: 500 });

  const snapshot: QuoteSnapshot = {
    version: 1,
    source_quote_id: q.id,
    frozen_at: new Date().toISOString(),
    request: doc.request,
    items: doc.items,
  };
  const now = new Date().toISOString();
  const { error: settingsError } = await supabaseAdmin.from('wa_settings').upsert([
    { key: quoteKeys.snapshot(invoice.id), value: snapshot, updated_at: now },
    { key: quoteKeys.transport(invoice.id), value: { mode: q.transport_mode ?? 'both' }, updated_at: now },
    { key: quoteKeys.invoiceOf(q.id), value: { invoice_id: invoice.id }, updated_at: now },
  ]);
  if (settingsError) {
    // Sans instantané, la facture n'aurait pas de contenu figé : on l'annule.
    await supabaseAdmin.from('quotes').delete().eq('id', invoice.id);
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  await supabaseAdmin.from('quotes').update({ status: 'accepted' }).eq('id', q.id);
  return NextResponse.json({ id: invoice.id, existing: false });
}
