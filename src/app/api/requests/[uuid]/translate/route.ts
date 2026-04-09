import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { translateBatch, type TranslationItem } from '@/lib/kimi/api';

export const maxDuration = 60;
const BUDGET_MS = 45_000; // Stop before gateway timeout

// POST: Re-translate existing search_results for a request
// Processes in batches, saves incrementally, and stops before timeout
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
    const startTime = Date.now();
    const remainingMs = () => BUDGET_MS - (Date.now() - startTime);

    // Fetch all results for this request
    const { data: items } = await supabaseAdmin
      .from('request_items')
      .select('id')
      .eq('request_id', uuid);

    if (!items?.length) {
      return NextResponse.json({ error: 'Aucun item trouvé' }, { status: 404 });
    }

    const itemIds = items.map((i) => i.id);

    const { data: results, error: resultsError } = await supabaseAdmin
      .from('search_results')
      .select('id, title, description, seller, title_original, description_original')
      .in('request_item_id', itemIds);

    if (resultsError) {
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }

    if (!results?.length) {
      return NextResponse.json({ error: 'Aucun résultat à traduire' }, { status: 404 });
    }

    // Process in small batches (6 at a time) with budget guard
    const BATCH_SIZE = 6;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      if (remainingMs() < 5000) {
        skipped = results.length - i;
        console.warn(`[Translate] Time budget low, skipping ${skipped} results`);
        break;
      }

      const batch = results.slice(i, i + BATCH_SIZE);

      const translationItems: TranslationItem[] = batch.map((r) => ({
        id: r.id,
        title: r.title_original || r.title || undefined,
        description: r.description_original || r.description || undefined,
        seller: r.seller || undefined,
      }));

      const translations = await translateBatch(translationItems);

      if (Object.keys(translations).length === 0) {
        // Kimi failed for this batch — stop trying to avoid wasting time
        skipped = results.length - i;
        console.warn(`[Translate] Kimi returned empty, stopping. Skipped ${skipped} results`);
        break;
      }

      // Update each result in this batch
      for (const result of batch) {
        const t = translations[result.id];
        if (!t) continue;
        const updateFields: Record<string, string> = {};
        if (t.title) {
          updateFields.title = t.title;
          if (!result.title_original) updateFields.title_original = result.title;
        }
        if (t.description) {
          updateFields.description = t.description;
          if (!result.description_original) updateFields.description_original = result.description;
        }
        if (t.seller) updateFields.seller = t.seller;

        if (Object.keys(updateFields).length > 0) {
          await supabaseAdmin.from('search_results').update(updateFields).eq('id', result.id);
          updated++;
        }
      }
    }

    const skippedNote = skipped > 0
      ? ` · ${skipped} restant(s) — recliquez pour continuer`
      : '';

    return NextResponse.json({
      message: `Traduction: ${updated}/${results.length} mis à jour${skippedNote}`,
      total: results.length,
      updated,
      skipped,
    });
  } catch (err) {
    console.error('Translate route error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
