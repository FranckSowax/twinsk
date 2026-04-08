import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { searchByImage, searchByKeyword } from '@/lib/taobao/api';
import { searchByImage1688, getItemDetail1688, searchByKeyword1688 } from '@/lib/alibaba1688/api';
import { translateBatch, translateToChinese, type TranslationItem } from '@/lib/kimi/api';

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
  main_image_url: string | null;
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
    const reset = request.nextUrl.searchParams.get('reset') === 'true';

    // If reset requested: delete all existing search_results and unflag items
    if (reset) {
      console.log(`[Search] Reset requested for request ${uuid}`);
      const { data: itemIds } = await supabaseAdmin
        .from('request_items')
        .select('id')
        .eq('request_id', uuid);

      if (itemIds?.length) {
        const ids = itemIds.map((i) => i.id);
        // Delete existing search results for these items
        await supabaseAdmin.from('search_results').delete().in('request_item_id', ids);
        // Reset processed flag
        await supabaseAdmin
          .from('request_items')
          .update({ processed: false })
          .in('id', ids);
      }
    }

    // Only fetch items that haven't been processed yet
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('request_items')
      .select('*')
      .eq('request_id', uuid)
      .eq('processed', false);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!items?.length) {
      return NextResponse.json({
        message: 'Tous les articles ont déjà été traités',
        results_count: 0,
      });
    }

    await supabaseAdmin
      .from('requests')
      .update({ status: 'processing' })
      .eq('id', uuid);

    const allResults: PendingResult[] = [];
    const errors: string[] = [];

    for (const item of items) {
      // Decide search mode based on what the client provided
      const hasImage = !!item.image_url;
      const hasText = !!item.description?.trim();

      let searchQuery: string | null = null;
      if (!hasImage && hasText) {
        // Text-only item: translate FR description to Chinese for keyword search
        try {
          searchQuery = await translateToChinese(item.description);
          console.log(`[Search] Item ${item.id} text→ZH: "${item.description}" → "${searchQuery}"`);
        } catch (err) {
          errors.push(`Translate FR→ZH failed for item ${item.id}: ${err}`);
          searchQuery = item.description;
        }
      }

      const [taobaoRes, alibaba1688Res] = await Promise.allSettled([
        hasImage
          ? searchByImage(item.image_url, { pageSize: 8 })
          : searchQuery
            ? searchByKeyword(searchQuery, { pageSize: 8 })
            : Promise.reject(new Error('No image or query')),
        hasImage
          ? searchByImage1688(item.image_url, { page: 1 })
          : searchQuery
            ? searchByKeyword1688(searchQuery, { pageSize: 8 })
            : Promise.reject(new Error('No image or query')),
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
          const numericId = taobaoItem.itemId;
          const idStr = taobaoItem.itemIdStr || '';
          const finalId = numericId || idStr;
          const taobaoMainImage = normalizeUrl(taobaoItem.image);
          // Only build a working URL if we have a numeric itemId
          // The itemIdStr from this API is encrypted and not usable as a direct URL parameter
          const productUrl = numericId
            ? `https://item.taobao.com/item.htm?id=${numericId}`
            : taobaoMainImage; // Fallback: link to image so admin can identify
          allResults.push({
            request_item_id: item.id,
            source: 'taobao',
            taobao_item_id: finalId,
            title: taobaoItem.title || 'Sans titre',
            title_original: taobaoItem.title || null,
            description: null,
            price: isNaN(price) ? 0 : price,
            image_url: taobaoMainImage,
            main_image_url: taobaoMainImage || null,
            seller: seller.storeTitle || null,
            product_url: productUrl,
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
        console.error(`[Search] Taobao failed for item ${item.id}:`, taobaoRes.reason);
        errors.push(`Taobao: ${String(taobaoRes.reason).slice(0, 150)}`);
      }

      // --- 1688 ---
      if (alibaba1688Res.status === 'fulfilled') {
        const list = alibaba1688Res.value.result?.resultList || [];
        const top = list.slice(0, 8);
        console.log(`[Search] 1688 returned ${list.length} results for item ${item.id}`);

        // For top results, fetch item detail to get richer data (main image, description)
        const detailPromises = top.slice(0, 5).map(async (entry) => {
          const itemId = entry.item?.itemId;
          if (!itemId) return null;
          try {
            return await getItemDetail1688(String(itemId));
          } catch (err) {
            console.warn(`[Search] 1688 detail failed for ${itemId}:`, err);
            return null;
          }
        });
        const details = await Promise.all(detailPromises);

        // Parser helper for price ranges like "2.45 - 3.40" → 2.45
        const parsePrice = (raw?: string): number => {
          if (!raw) return 0;
          const match = raw.match(/[\d.]+/);
          const v = match ? parseFloat(match[0]) : NaN;
          return isNaN(v) ? 0 : v;
        };

        top.forEach((entry, idx) => {
          const aliItem = entry.item || {};
          const detail = details[idx];
          const detailItem = detail?.result?.item;

          // Price: prefer promotionPrice, then price; strip range
          const price = parsePrice(
            aliItem.sku?.def?.promotionPrice ||
              aliItem.sku?.def?.price ||
              detailItem?.sku?.def?.promotionPrice ||
              detailItem?.sku?.def?.price
          );

          const numericId1688 = aliItem.itemId ? String(aliItem.itemId) : '';

          // MOQ from sku.def.minOrder (string or number)
          const rawMoq = aliItem.sku?.def?.minOrder ?? detailItem?.sku?.def?.minOrder;
          const moq = rawMoq != null ? Number(rawMoq) || null : null;

          // Product URL: from itemUrl (normalized) or built from id
          const productUrl = numericId1688
            ? `https://detail.1688.com/offer/${numericId1688}.html`
            : normalizeUrl(aliItem.itemUrl);

          // Thumbnail + main image
          const aliThumb = normalizeUrl(aliItem.image);
          const aliMainImage = normalizeUrl(
            detailItem?.images?.[0] || aliItem.image
          );

          // Description from properties list (concatenated) if available
          let description: string | null = null;
          if (detailItem?.properties?.list?.length) {
            description = detailItem.properties.list
              .map((p) => `${p.name}: ${p.value}`)
              .join(' · ');
          }

          allResults.push({
            request_item_id: item.id,
            source: '1688',
            taobao_item_id: numericId1688,
            title: aliItem.title || detailItem?.title || 'Sans titre',
            title_original: aliItem.title || detailItem?.title || null,
            description,
            price,
            image_url: aliThumb,
            main_image_url: aliMainImage || aliThumb || null,
            seller: null, // 1688 list endpoint doesn't return seller info
            product_url: productUrl,
            selected: false,
            quantity: 1,
            margin_percent: 0,
            moq,
            weight: null, // not available from item_detail endpoint alone
            volume: null,
            dimensions: null,
            client_quantity: null,
          });
        });
      } else {
        const reasonStr = String(alibaba1688Res.reason);
        console.error(`[Search] 1688 failed for item ${item.id}:`, reasonStr);
        if (reasonStr.includes('403') || reasonStr.includes('not subscribed')) {
          errors.push('1688: API non souscrite sur RapidAPI — souscrivez à 1688 DataHub pour activer cette source');
        } else {
          errors.push(`1688: ${reasonStr.slice(0, 150)}`);
        }
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
      const translationCount = Object.keys(translations).length;

      if (translationCount === 0) {
        errors.push('Translation failed (Kimi) — titles will remain in Chinese. Check KIMI_API_KEY env var.');
      }

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

    // Mark processed items
    const processedItemIds = items.map((it) => it.id);
    if (processedItemIds.length > 0) {
      await supabaseAdmin
        .from('request_items')
        .update({ processed: true })
        .in('id', processedItemIds);
    }

    return NextResponse.json({
      message: `Recherche terminée: ${totalResults} résultats trouvés sur ${items.length} article(s)`,
      results_count: totalResults,
      processed_items: items.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error('Search route error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
