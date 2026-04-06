import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Quote, RequestItemWithResults } from '@/lib/types/database';

// GET: Get quote details with all associated data
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    const q = quote as Quote;

    const { data: request } = await supabaseAdmin
      .from('requests')
      .select('*')
      .eq('id', q.request_id)
      .single();

    const { data: items } = await supabaseAdmin
      .from('request_items')
      .select('*, search_results(*)')
      .eq('request_id', q.request_id);

    const typedItems = (items || []) as unknown as RequestItemWithResults[];

    const selectedItems = typedItems
      .map((item) => ({
        ...item,
        search_results: (item.search_results || []).filter((r) => r.selected),
      }))
      .filter((item) => item.search_results.length > 0);

    return NextResponse.json({
      quote: q,
      request,
      items: selectedItems,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
