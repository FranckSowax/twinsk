import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { searchByImage } from '@/lib/taobao/api';

// POST: Trigger Taobao image search for all items in a request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    // Check admin auth
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { uuid } = await params;

    // Get all request items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('request_items')
      .select('*')
      .eq('request_id', uuid);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'Aucun article trouvé' }, { status: 404 });
    }

    // Update status to processing
    await supabaseAdmin
      .from('requests')
      .update({ status: 'processing' })
      .eq('id', uuid);

    let totalResults = 0;

    for (const item of items) {
      try {
        const response = await searchByImage(item.image_url, { pageSize: 10 });

        if (response.data?.items?.length) {
          const results = response.data.items.map((taobaoItem) => ({
            request_item_id: item.id,
            taobao_item_id: taobaoItem.itemId || '',
            title: taobaoItem.title || 'Sans titre',
            price: parseFloat(taobaoItem.price) || 0,
            image_url: taobaoItem.image || '',
            seller: taobaoItem.shopName || taobaoItem.sellerNick || null,
            product_url: taobaoItem.itemUrl || `https://item.taobao.com/item.htm?id=${taobaoItem.itemId}`,
            selected: false,
            quantity: 1,
            margin_percent: 0,
          }));

          const { error: insertError } = await supabaseAdmin
            .from('search_results')
            .insert(results);

          if (!insertError) {
            totalResults += results.length;
          }
        }
      } catch (err) {
        console.error(`Search failed for item ${item.id}:`, err);
        // Continue with next item
      }
    }

    return NextResponse.json({
      message: `Recherche terminée: ${totalResults} résultats trouvés`,
      results_count: totalResults,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
