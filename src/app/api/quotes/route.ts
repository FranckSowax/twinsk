import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { RequestItemWithResults } from '@/lib/types/database';
import { normalizeQuoteTransportMode } from '@/lib/quote-transport';
import { quoteLinesTotal, resolveAllQuoteLines, type QuoteSourceResult } from '@/lib/variant-picks';

// POST: Generate a quote from selected results
export async function POST(request: NextRequest) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { request_id, margin_global, document_type, transport_mode } = await request.json();
    const transportMode = normalizeQuoteTransportMode(transport_mode);

    if (!request_id) {
      return NextResponse.json({ error: 'request_id requis' }, { status: 400 });
    }

    const docType: 'devis' | 'packing_list' = document_type === 'packing_list' ? 'packing_list' : 'devis';

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('request_items')
      .select('*, search_results(*)')
      .eq('request_id', request_id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const typedItems = (items || []) as unknown as RequestItemWithResults[];
    const selectedResults = typedItems
      .flatMap((item) => item.search_results || [])
      .filter((r) => r.selected);

    if (!selectedResults.length) {
      return NextResponse.json({ error: 'Aucun produit sélectionné' }, { status: 400 });
    }

    // Une ligne par variante retenue (pick_qty), sinon une ligne produit
    // (variante principale = choix client ou première).
    const lines = resolveAllQuoteLines(
      selectedResults.map((r) => ({
        ...(r as unknown as QuoteSourceResult),
        margin_percent: r.margin_percent || margin_global || 0,
      })),
    );
    const totalAmount = quoteLinesTotal(lines);

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .insert({
        request_id,
        total_amount: docType === 'packing_list' ? 0 : Math.round(totalAmount * 100) / 100,
        margin_global: margin_global || 0,
        status: 'draft',
        document_type: docType,
      })
      .select()
      .single();

    if (quoteError) {
      return NextResponse.json({ error: quoteError.message }, { status: 500 });
    }

    // Mode de transport retenu : mémorisé dans les réglages (pas de colonne
    // sur quotes, aucune migration) et relu par GET /api/quotes/[id].
    await supabaseAdmin.from('wa_settings').upsert({
      key: `quote_transport:${quote.id}`,
      value: { mode: transportMode },
      updated_at: new Date().toISOString(),
    });

    await supabaseAdmin
      .from('requests')
      .update({ status: 'quoted' })
      .eq('id', request_id);

    return NextResponse.json({ ...quote, transport_mode: transportMode });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
