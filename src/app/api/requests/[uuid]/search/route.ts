import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { searchByImage } from '@/lib/taobao/api';
import { searchByImage1688, getItemDetail1688 } from '@/lib/alibaba1688/api';
import { translateBatch, type TranslationItem } from '@/lib/kimi/api';

export const maxDuration = 60;

function normalizeUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  return `https://${url}`;
}

interface PendingResult {
  request_item_id: string;
  source: 'taobao' | '1688';
  taobao_item_id: string;
  title: string;
  title_original: string | null;
  description: string | null;
  price: number;
  image_url: string;
  seller: string | null;
  product_url: string;
  selected: boolean;
  quantity: number;
  margin_percent: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  client_quantity: number | null;
}

// POST: Trigger Taobao + 1688 image search, translate via Kimi, store in DB
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

    const allResults: PendingResult[] = [];
    const errors: string[] = [];

    for (const item of items) {
      const [taobaoRes, alibaba1688Res] = await Promise.allSettled([
        searchByImage(item.image_url, { pageSize: 8 }),
        searchByImage1688(item.image_url, { page: 1 }),
      ]);

      // --- Taobao ---
      if (taobaoRes.status === 'fulfilled') {
        const list = taobaoRes.value.result?.resultList || [];
        for (const entry of list.slice(0, 8)) {
          const taobaoItem = entry.item || {};
          const seller = entry.seller || {};
          const price = parseFloat(
            taobaoItem.sku?.def?.promotionPrice ||
            taobaoItem.sku?.def?.price ||
            '0'
          );
          const itemId = taobaoItem.itemId || taobaoItem.itemIdStr || '';
          allResults.push({
            request_item_id: item.id,
            source: 'taobao',
            taobao_item_id: itemId,
            title: taobaoItem.title || 'Sans titre',
            title_original: taobaoItem.title || null,
            description: null,
            price: isNaN(price) ? 0 : price,
            image_url: normalizeUrl(taobaoItem.image),
            seller: seller.storeTitle || null,
            product_url: `https://item.taobao.com/item.htm?id=${itemId}`,
            selected: false,
            quantity: 1,
            margin_percent: 0,
            moq: null,
            weight: null,
            volume: null,
            dimensions: null,
            client_quantity: null,
          });
        }
      } else {
        errors.push(`Taobao failed for item ${item.id}: ${taobaoRes.reason}`);
      }

      // --- 1688 ---
      if (alibaba1688Res.status === 'fulfilled') {
        const list = alibaba1688Res.value.result?.resultList || [];
        const top = list.slice(0, 8);

        // For top results, fetch item detail to get MOQ/weight (parallel, capped to 5)
        const detailPromises = top.slice(0, 5).map(async (entry) => {
          const itemId = entry.item?.itemId || entry.item?.itemIdStr;
          if (!itemId) return null;
          try {
            return await getItemDetail1688(itemId);
          } catch {
            return null;
          }
        });
        const details = await Promise.all(detailPromises);

        top.forEach((entry, idx) => {
          const aliItem = entry.item || {};
          const seller = entry.seller || {};
          const detail = details[idx];
          const detailItem = detail?.result?.item;
          const pkg = detailItem?.packageInfo;

          const price = parseFloat(
            aliItem.sku?.def?.promotionPrice ||
            aliItem.sku?.def?.price ||
            detail?.result?.sku?.def?.promotionPrice ||
            detail?.result?.sku?.def?.price ||
            '0'
          );
          const itemId = aliItem.itemId || aliItem.itemIdStr || '';
          const moq = aliItem.minOrderQuantity ?? aliItem.moq ?? detailItem?.minOrderQuantity ?? null;
          const weight = aliItem.unitWeight ?? aliItem.weight ?? detailItem?.unitWeight ?? detailItem?.weight ?? pkg?.weight ?? null;
          const volume = pkg?.volume ?? null;
          const dimensions = pkg?.length && pkg?.width && pkg?.height
            ? `${pkg.length}x${pkg.width}x${pkg.height} ${pkg.unit || 'cm'}`
            : null;

          allResults.push({
            request_item_id: item.id,
            source: '1688',
            taobao_item_id: itemId,
            title: aliItem.title || detailItem?.title || 'Sans titre',
            title_original: aliItem.title || detailItem?.title || null,
            description: detailItem?.description || null,
            price: isNaN(price) ? 0 : price,
            image_url: normalizeUrl(aliItem.image),
            seller: seller.storeTitle || null,
            product_url: `https://detail.1688.com/offer/${itemId}.html`,
            selected: false,
            quantity: 1,
            margin_percent: 0,
            moq,
            weight,
            volume,
            dimensions,
            client_quantity: null,
          });
        });
      } else {
        errors.push(`1688 failed for item ${item.id}: ${alibaba1688Res.reason}`);
      }
    }

    // --- Translation step (Kimi) ---
    if (allResults.length > 0) {
      const translationItems: TranslationItem[] = allResults.map((r, idx) => ({
        id: String(idx),
        title: r.title_original || undefined,
        description: r.description || undefined,
        seller: r.seller || undefined,
      }));

      const translations = await translateBatch(translationItems);

      allResults.forEach((r, idx) => {
        const t = translations[String(idx)];
        if (t) {
          if (t.title) r.title = t.title;
          if (t.description) r.description = t.description;
          if (t.seller) r.seller = t.seller;
        }
      });
    }

    // --- Insert into DB ---
    let totalResults = 0;
    if (allResults.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('search_results')
        .insert(allResults);

      if (insertError) {
        console.error('Insert error:', insertError);
        errors.push(`Insert failed: ${insertError.message}`);
      } else {
        totalResults = allResults.length;
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
