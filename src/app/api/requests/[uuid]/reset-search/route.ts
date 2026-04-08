import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: Delete all search results for a request and reset processed flags
// Fast operation (no external API calls) — called before re-running a search
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { uuid } = await params;

    // Get all request_item IDs for this request
    const { data: itemIds, error: itemsError } = await supabaseAdmin
      .from('request_items')
      .select('id')
      .eq('request_id', uuid);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!itemIds?.length) {
      return NextResponse.json({ message: 'Aucun article', deleted: 0 });
    }

    const ids = itemIds.map((i) => i.id);

    // Delete existing search results
    const { error: delError } = await supabaseAdmin
      .from('search_results')
      .delete()
      .in('request_item_id', ids);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    // Reset processed flag on all items
    const { error: updateError } = await supabaseAdmin
      .from('request_items')
      .update({ processed: false })
      .in('id', ids);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Reset request status back to 'submitted'
    await supabaseAdmin
      .from('requests')
      .update({ status: 'submitted' })
      .eq('id', uuid);

    return NextResponse.json({
      message: `Recherche réinitialisée (${ids.length} article(s))`,
      items_reset: ids.length,
    });
  } catch (err) {
    console.error('Reset search error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
