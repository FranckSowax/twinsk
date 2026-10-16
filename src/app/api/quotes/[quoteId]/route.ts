import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { loadQuoteDocument } from '@/lib/quote-data';
import { documentMeta, normalizeDocumentType, quoteKeys } from '@/lib/quote-documents';

// GET : un document (devis, colisage ou facture) avec ses données. Une facture
// renvoie l'instantané figé à sa création, un devis les données en direct.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const doc = await loadQuoteDocument(quoteId);
    if (!doc) return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    return NextResponse.json({ quote: doc.quote, request: doc.request, items: doc.items, frozen: doc.frozen });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE : supprime un document généré (devis, colisage ou facture) et les
// réglages qui l'accompagnent — mode et forfait de transport, instantané figé,
// lien devis ↔ facture dans les deux sens. Réservé à l'admin ; rien d'autre
// n'est touché (la demande, ses produits et les autres documents restent).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { quoteId } = await params;

  const { data: quote } = await supabaseAdmin.from('quotes').select('id, document_type').eq('id', quoteId).maybeSingle();
  if (!quote) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
  const type = normalizeDocumentType((quote as { document_type?: unknown }).document_type);

  // Réglages à retirer : les siens, et le lien porté par le devis d'origine
  // quand on supprime une facture (sinon le devis garderait un lien mort).
  const keys = [quoteKeys.transport(quoteId), quoteKeys.snapshot(quoteId), quoteKeys.invoiceOf(quoteId)];
  if (type === 'facture') {
    const { data: links } = await supabaseAdmin.from('wa_settings').select('key, value').like('key', `${quoteKeys.invoiceOf('')}%`);
    for (const row of (links || []) as { key: string; value: { invoice_id?: string } | null }[]) {
      if (row.value?.invoice_id === quoteId) keys.push(row.key);
    }
  }

  const { error } = await supabaseAdmin.from('quotes').delete().eq('id', quoteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from('wa_settings').delete().in('key', keys);
  return NextResponse.json({ success: true, document: documentMeta(type).title });
}
