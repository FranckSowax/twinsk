import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { loadQuoteDocument, type QuoteSnapshot } from '@/lib/quote-data';
import { canConvertToInvoice, quoteKeys } from '@/lib/quote-documents';
import { quoteLinesTotal, resolveAllQuoteLines, type QuoteSourceResult } from '@/lib/variant-picks';
import { normalizeSeaOverride } from '@/lib/quote-transport';

// POST { sea_override?: { amount, currency, label?, containers? } } :
// transforme un devis en facture (admin).
// - La facture est un nouveau document (document_type « facture ») dont le
//   contenu est FIGÉ : client, destination, produits, prix, quantités et mode
//   de transport sont copiés dans `quote_snapshot:<id>`.
// - Transport : une facture porte TOUJOURS le forfait maritime négocié — jamais
//   un calcul au CBM. Le montant saisi ici l'emporte ; sinon on reprend celui du
//   devis. Sans forfait ni sur l'un ni sur l'autre, la facture n'est pas créée.
// - Idempotent : un devis déjà transformé renvoie sa facture existante.
// - Le devis passe au statut « accepted ».
export async function POST(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { quoteId } = await params;

  const body = (await request.json().catch(() => ({}))) as { sea_override?: unknown };

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

  // Forfait maritime négocié : saisi à la transformation, sinon celui du devis.
  const seaOverride = normalizeSeaOverride(body.sea_override) ?? q.transport_sea_override ?? null;
  if (!seaOverride) {
    return NextResponse.json(
      { error: 'Forfait maritime négocié requis : saisissez-le ici, ou fixez-le sur le devis (sélecteur de transport). Une facture ne se chiffre pas au CBM.' },
      { status: 400 },
    );
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
    { key: quoteKeys.transport(invoice.id), value: { mode: 'sea', sea_override: seaOverride }, updated_at: now },
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
