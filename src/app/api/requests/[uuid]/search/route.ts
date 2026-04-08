import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { searchByImage, searchByKeyword } from '@/lib/taobao/api';
import { searchByImage1688, getItemDetail1688, searchByKeyword1688 } from '@/lib/alibaba1688/api';
import { translateBatch, translateToChinese, findFactories, type TranslationItem } from '@/lib/kimi/api';

export const maxDuration = 60;

// Hard time budget: stop processing new items after this many ms to avoid gateway 502
const PROCESSING_BUDGET_MS = 45_000;

function normalizeUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  return `https://${url}`;
}

interface PendingResult {
  request_item_id: string;
  source: 'taobao' | '1688' | 'factory';
  taobao_item_id: string;
  title: string;
  title_original: string | null;
  description: string | null;
  description_original: string | null;
  price: number;
  image_url: string;
  main_image_url: string | null;
  extra_images: string[] | null;
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
    const processedItemIds: string[] = [];
    const startTime = Date.now();
    const remainingMs = () => PROCESSING_BUDGET_MS - (Date.now() - startTime);
    let skippedItems = 0;

    // Track API availability — once a quota is exhausted, skip further calls to that API
    let taobaoQuotaExhausted = false;
    let alibaba1688QuotaExhausted = false;
    let kimiOverloaded = false;
    let consecutiveFactoryEmpty = 0;

    const isQuotaError = (reason: unknown): boolean => {
      const s = String(reason);
      return (
        s.includes('429') &&
        (s.includes('exceeded') || s.includes('quota') || s.includes('MONTHLY'))
      );
    };

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      // Time budget guard — stop processing new items if we're close to the gateway timeout
      if (remainingMs() <= 0) {
        skippedItems = items.length - idx;
        console.warn(`[Search] Time budget exhausted, skipping ${skippedItems} item(s)`);
        break;
      }
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

      // Skip API calls entirely if quota already exhausted for a given provider
      const taobaoCall = taobaoQuotaExhausted
        ? Promise.reject(new Error('Taobao quota exhausted — skipped'))
        : hasImage
          ? searchByImage(item.image_url, { pageSize: 8 })
          : searchQuery
            ? searchByKeyword(searchQuery, { pageSize: 8 })
            : Promise.reject(new Error('No image or query'));

      const alibaba1688Call = alibaba1688QuotaExhausted
        ? Promise.reject(new Error('1688 quota exhausted — skipped'))
        : hasImage
          ? searchByImage1688(item.image_url, { page: 1 })
          : searchQuery
            ? searchByKeyword1688(searchQuery, { pageSize: 8 })
            : Promise.reject(new Error('No image or query'));

      const [taobaoRes, alibaba1688Res] = await Promise.allSettled([
        taobaoCall,
        alibaba1688Call,
      ]);

      // Detect quota exhaustion — stop calling for the rest of the items
      if (taobaoRes.status === 'rejected' && isQuotaError(taobaoRes.reason)) {
        if (!taobaoQuotaExhausted) {
          errors.push('Taobao: quota mensuel RapidAPI épuisé — upgrade nécessaire');
          console.warn('[Search] Taobao quota exhausted, skipping further calls');
        }
        taobaoQuotaExhausted = true;
      }
      if (alibaba1688Res.status === 'rejected' && isQuotaError(alibaba1688Res.reason)) {
        if (!alibaba1688QuotaExhausted) {
          errors.push('1688: quota mensuel RapidAPI épuisé — upgrade nécessaire');
          console.warn('[Search] 1688 quota exhausted, skipping further calls');
        }
        alibaba1688QuotaExhausted = true;
      }

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
            description_original: null,
            price: isNaN(price) ? 0 : price,
            image_url: taobaoMainImage,
            main_image_url: taobaoMainImage || null,
            extra_images: null,
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
      } else if (!isQuotaError(taobaoRes.reason)) {
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

          // Thumbnail + main image + extras
          const aliThumb = normalizeUrl(aliItem.image);
          const allImages = (detailItem?.images || [])
            .map((img) => normalizeUrl(img))
            .filter((u) => !!u);
          const aliMainImage = allImages[0] || aliThumb;
          const extraImages = allImages.length > 1 ? allImages.slice(0, 8) : null;

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
            description_original: description,
            price,
            image_url: aliThumb,
            main_image_url: aliMainImage || aliThumb || null,
            extra_images: extraImages,
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
      } else if (!isQuotaError(alibaba1688Res.reason)) {
        const reasonStr = String(alibaba1688Res.reason);
        console.error(`[Search] 1688 failed for item ${item.id}:`, reasonStr);
        if (reasonStr.includes('403') || reasonStr.includes('not subscribed')) {
          errors.push('1688: API non souscrite sur RapidAPI — souscrivez à 1688 DataHub pour activer cette source');
        } else {
          errors.push(`1688: ${reasonStr.slice(0, 150)}`);
        }
      }

      // --- Factory search via Kimi (expert sourcing Chine) ---
      // Build a descriptive query: use client description if present, else use title from first search result
      let factoryQuery = item.description?.trim() || '';
      if (!factoryQuery) {
        // Fallback: take the first Taobao/1688 result title we just collected for this item
        const firstForItem = allResults.find((r) => r.request_item_id === item.id);
        factoryQuery = firstForItem?.title_original || firstForItem?.title || '';
      }

      if (factoryQuery && !kimiOverloaded) {
        try {
          const factories = await findFactories(factoryQuery);
          console.log(`[Search] Factory search for "${factoryQuery}": ${factories.length} result(s)`);

          // Heuristic: if findFactories returns [] twice in a row, assume Kimi is overloaded
          if (factories.length === 0) {
            consecutiveFactoryEmpty++;
            if (consecutiveFactoryEmpty >= 2) {
              kimiOverloaded = true;
              errors.push('Kimi (recherche usines) saturé — appels arrêtés, la traduction finale sera aussi impactée');
              console.warn('[Search] Kimi overloaded (2 consecutive empty factory results), stopping further calls');
            }
          } else {
            consecutiveFactoryEmpty = 0;
          }

          for (const f of factories) {
            // Build description aggregating contact + metadata
            const contactLines: string[] = [];
            if (f.contact.phone) contactLines.push(`Tél: ${f.contact.phone}`);
            if (f.contact.whatsapp) contactLines.push(`WhatsApp: ${f.contact.whatsapp}`);
            if (f.contact.wechat) contactLines.push(`WeChat: ${f.contact.wechat}`);
            if (f.contact.email) contactLines.push(`Email: ${f.contact.email}`);
            if (f.contact.website) contactLines.push(`Site: ${f.contact.website}`);

            const descParts: string[] = [];
            if (f.specialties) descParts.push(`Spécialités: ${f.specialties}`);
            if (f.years_experience != null) descParts.push(`Expérience: ${f.years_experience} ans`);
            if (f.city) descParts.push(`Localisation: ${f.city}`);
            if (f.reviews_summary) descParts.push(`Réputation: ${f.reviews_summary}`);
            if (f.why) descParts.push(`Recommandation: ${f.why}`);
            descParts.push(`\nContact:\n${contactLines.join('\n')}`);

            allResults.push({
              request_item_id: item.id,
              source: 'factory',
              taobao_item_id: '',
              title: f.name,
              title_original: f.name,
              description: descParts.join(' · '),
              description_original: descParts.join(' · '),
              price: f.estimated_price_cny ?? 0,
              image_url: '',
              main_image_url: null,
              extra_images: null,
              seller: f.city || null,
              product_url: f.contact.website || '',
              selected: false,
              quantity: 1,
              margin_percent: 0,
              moq: f.moq ?? null,
              weight: null,
              volume: null,
              dimensions: null,
              client_quantity: null,
            });
          }
        } catch (err) {
          console.error(`[Search] Factory search failed for item ${item.id}:`, err);
          errors.push(`Factory search: ${String(err).slice(0, 150)}`);
        }
      }

      // Mark this item as processed (successfully or not — we at least attempted it)
      processedItemIds.push(item.id);
    }

    // --- Translation step (Kimi) ---
    // Skip if Kimi is overloaded or if we're running out of time budget
    const canTranslate = allResults.length > 0 && !kimiOverloaded && remainingMs() > 5000;
    if (allResults.length > 0 && !canTranslate) {
      errors.push(
        kimiOverloaded
          ? 'Traduction reportée (Kimi saturé) — utilisez "Retraduire en FR" plus tard'
          : 'Traduction reportée (temps limité) — utilisez "Retraduire en FR" plus tard'
      );
    }
    if (canTranslate) {
      const translationItems: TranslationItem[] = allResults.map((r, idx) => ({
        id: String(idx),
        title: r.title_original || undefined,
        description: r.description_original || r.description || undefined,
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

    // Mark as processed only the items we actually reached in the loop
    if (processedItemIds.length > 0) {
      await supabaseAdmin
        .from('request_items')
        .update({ processed: true })
        .in('id', processedItemIds);
    }

    const processedCount = processedItemIds.length;
    const skippedNote =
      skippedItems > 0
        ? ` · ${skippedItems} article(s) reporté(s) — cliquez à nouveau sur "Recherche"`
        : '';

    return NextResponse.json({
      message: `Recherche terminée: ${totalResults} résultats sur ${processedCount}/${items.length} article(s) traité(s)${skippedNote}`,
      results_count: totalResults,
      processed_items: processedCount,
      skipped_items: skippedItems,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error('Search route error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
