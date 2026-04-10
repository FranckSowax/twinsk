import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { translateBatch, type TranslationItem } from '@/lib/kimi/api';

export const maxDuration = 60;
const BUDGET_MS = 45_000;
const BATCH_SIZE = 6;

// POST: Translate catalog entries that still contain Chinese text
export async function POST(request: NextRequest) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const startTime = Date.now();
    const remainingMs = () => BUDGET_MS - (Date.now() - startTime);

    // Fetch catalog entries with Chinese characters in title
    const { data: allEntries, error } = await supabaseAdmin
      .from('catalog')
      .select('id, title, title_original, description, description_original, seller')
      .order('search_count', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to entries that still need translation (contain Chinese chars)
    const hasChinese = (text: string | null) => {
      if (!text) return false;
      return /[\u4e00-\u9fff]/.test(text);
    };

    const needsTranslation = (allEntries || []).filter(
      (e) => hasChinese(e.title) || hasChinese(e.description)
    );

    const totalInCatalog = allEntries?.length || 0;
    const alreadyDone = totalInCatalog - needsTranslation.length;

    if (!needsTranslation.length) {
      return NextResponse.json({
        message: `Catalogue entièrement traduit (${totalInCatalog} entrées)`,
        total: totalInCatalog,
        updated: 0,
        remaining: 0,
      });
    }

    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < needsTranslation.length; i += BATCH_SIZE) {
      if (remainingMs() < 5000) {
        skipped = needsTranslation.length - i;
        break;
      }

      const batch = needsTranslation.slice(i, i + BATCH_SIZE);

      const translationItems: TranslationItem[] = batch.map((e) => ({
        id: e.id,
        title: e.title_original || e.title || undefined,
        description: e.description_original || e.description || undefined,
        seller: e.seller || undefined,
      }));

      const translations = await translateBatch(translationItems);

      if (Object.keys(translations).length === 0) {
        skipped = needsTranslation.length - i;
        console.warn('[CatalogTranslate] Kimi returned empty, stopping');
        break;
      }

      for (const entry of batch) {
        const t = translations[entry.id];
        if (!t) continue;

        const updateFields: Record<string, string> = {};
        // Only accept translation if the result actually changed to non-Chinese
        if (t.title && !hasChinese(t.title)) {
          updateFields.title = t.title;
          if (!entry.title_original) updateFields.title_original = entry.title;
        }
        if (t.description && !hasChinese(t.description)) {
          updateFields.description = t.description;
          if (!entry.description_original) updateFields.description_original = entry.description;
        }
        if (t.seller && !hasChinese(t.seller)) updateFields.seller = t.seller;

        if (Object.keys(updateFields).length > 0) {
          await supabaseAdmin.from('catalog').update(updateFields).eq('id', entry.id);
          updated++;
        }
      }
    }

    const totalDone = alreadyDone + updated;
    const remaining = totalInCatalog - totalDone;
    const remainNote = remaining > 0 ? ` · ${remaining} restant(s) — recliquez` : '';

    return NextResponse.json({
      message: `Catalogue: ${totalDone}/${totalInCatalog} traduit(s)${remainNote}`,
      total: totalInCatalog,
      updated,
      remaining,
    });
  } catch (err) {
    console.error('Catalog translate error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
