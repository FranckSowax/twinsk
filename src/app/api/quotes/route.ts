import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { RequestItemWithResults } from '@/lib/types/database';

// POST: Generate a quote from selected results
export async function POST(request: NextRequest) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { request_id, margin_global } = await request.json();

    if (!request_id) {
      return NextResponse.json({ error: 'request_id requis' }, { status: 400 });
    }

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

    const totalAmount = selectedResults.reduce((sum, r) => {
      const margin = r.margin_percent || margin_global || 0;
      return sum + r.price * (1 + margin / 100) * r.quantity;
    }, 0);

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .insert({
        request_id,
        total_amount: Math.round(totalAmount * 100) / 100,
        margin_global: margin_global || 0,
        status: 'draft',
      })
      .select()
      .single();

    if (quoteError) {
      return NextResponse.json({ error: quoteError.message }, { status: 500 });
    }

    await supabaseAdmin
      .from('requests')
      .update({ status: 'quoted' })
      .eq('id', request_id);

    return NextResponse.json(quote);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
