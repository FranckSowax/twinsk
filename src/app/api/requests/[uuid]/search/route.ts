import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { searchByImage } from '@/lib/taobao/api';

function normalizeUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  return `https://${url}`;
}

// POST: Trigger Taobao image search for all items in a request (admin only)
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

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('request_items')
      .select('*')
      .eq('request_id', uuid);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'Aucun article trouvé' }, { status: 404 });
    }

    await supabaseAdmin
      .from('requests')
      .update({ status: 'processing' })
      .eq('id', uuid);

    let totalResults = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const response = await searchByImage(item.image_url, { pageSize: 10 });
        const resultList = response.result?.resultList || [];

        if (resultList.length) {
          const results = resultList.map((entry) => {
            const taobaoItem = entry.item || {};
            const seller = entry.seller || {};
            const price = parseFloat(
              taobaoItem.sku?.def?.promotionPrice ||
              taobaoItem.sku?.def?.price ||
              '0'
            );
            const itemId = taobaoItem.itemId || taobaoItem.itemIdStr || '';
            return {
              request_item_id: item.id,
              taobao_item_id: itemId,
              title: taobaoItem.title || 'Sans titre',
              price: isNaN(price) ? 0 : price,
              image_url: normalizeUrl(taobaoItem.image),
              seller: seller.storeTitle || null,
              product_url: `https://item.taobao.com/item.htm?id=${itemId}`,
              selected: false,
              quantity: 1,
              margin_percent: 0,
            };
          });

          const { error: insertError } = await supabaseAdmin
            .from('search_results')
            .insert(results);

          if (insertError) {
            console.error(`Insert error for item ${item.id}:`, insertError);
            errors.push(`Insert failed: ${insertError.message}`);
          } else {
            totalResults += results.length;
          }
        }
      } catch (err) {
        console.error(`Search failed for item ${item.id}:`, err);
        errors.push(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    return NextResponse.json({
      message: `Recherche terminée: ${totalResults} résultats trouvés`,
      results_count: totalResults,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error('Search route error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
