// Données d'un document (devis / colisage / facture) pour l'écran et le PDF.
// Devis et colisage : lus en direct dans la demande. Facture : instantané figé
// au moment de la transformation (`quote_snapshot:<id>`), pour qu'une facture
// émise ne change plus si la demande est modifiée ensuite.

import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeQuoteTransportMode } from '@/lib/quote-transport';
import { quoteKeys } from '@/lib/quote-documents';
import type { Quote, Request as RequestType, RequestItemWithResults } from '@/lib/types/database';

export interface QuoteSnapshot {
  version: 1;
  source_quote_id: string;
  frozen_at: string;
  request: RequestType;
  /** Articles de la demande avec leurs seuls résultats retenus. */
  items: RequestItemWithResults[];
}

async function setting<T>(key: string): Promise<T | null> {
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as T | undefined) ?? null;
}

/** Articles retenus en direct (même règle que la génération du devis). */
export async function loadLiveInputs(requestId: string): Promise<{ request: RequestType | null; items: RequestItemWithResults[] }> {
  const { data: request } = await supabaseAdmin.from('requests').select('*').eq('id', requestId).single();
  const { data: items } = await supabaseAdmin.from('request_items').select('*, search_results(*)').eq('request_id', requestId);
  const selected = ((items || []) as unknown as RequestItemWithResults[])
    .map((item) => ({ ...item, search_results: (item.search_results || []).filter((r) => r.selected) }))
    .filter((item) => item.search_results.length > 0);
  return { request: (request as RequestType | null) ?? null, items: selected };
}

export async function loadQuoteDocument(quoteId: string): Promise<{
  quote: Quote;
  request: RequestType | null;
  items: RequestItemWithResults[];
  frozen: boolean;
} | null> {
  const { data: quote } = await supabaseAdmin.from('quotes').select('*').eq('id', quoteId).single();
  if (!quote) return null;
  const q = quote as Quote;
  const tm = await setting<{ mode?: unknown }>(quoteKeys.transport(q.id));
  q.transport_mode = normalizeQuoteTransportMode(tm?.mode);

  if (q.document_type === 'facture') {
    const snap = await setting<QuoteSnapshot>(quoteKeys.snapshot(q.id));
    if (snap?.request && Array.isArray(snap.items)) {
      q.source_quote_id = snap.source_quote_id;
      return { quote: q, request: snap.request, items: snap.items, frozen: true };
    }
  } else {
    const inv = await setting<{ invoice_id?: string }>(quoteKeys.invoiceOf(q.id));
    q.invoice_id = inv?.invoice_id ?? null;
  }
  const live = await loadLiveInputs(q.request_id);
  return { quote: q, ...live, frozen: false };
}
