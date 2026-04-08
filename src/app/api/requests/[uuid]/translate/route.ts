import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { translateBatch, type TranslationItem } from '@/lib/kimi/api';

export const maxDuration = 60;

// POST: Re-translate existing search_results for a request that have Chinese titles
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
      .select('id, title, description, seller, title_original')
      .in('request_item_id', itemIds);

    if (resultsError) {
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }

    if (!results?.length) {
      return NextResponse.json({ error: 'Aucun résultat à traduire' }, { status: 404 });
    }

    // Build translation payload — use title_original if present, otherwise current title
    const translationItems: TranslationItem[] = results.map((r) => ({
      id: r.id,
      title: r.title_original || r.title || undefined,
      description: r.description || undefined,
      seller: r.seller || undefined,
    }));

    const translations = await translateBatch(translationItems);
    const translationCount = Object.keys(translations).length;

    if (translationCount === 0) {
      return NextResponse.json(
        { error: 'Traduction échouée — vérifier KIMI_API_KEY sur Railway' },
        { status: 500 }
      );
    }

    // Update each result individually
    let updated = 0;
    for (const result of results) {
      const t = translations[result.id];
      if (!t) continue;
      const updateFields: Record<string, string> = {};
      if (t.title) {
        updateFields.title = t.title;
        // Preserve original if not already set
        if (!result.title_original) {
          updateFields.title_original = result.title;
        }
      }
      if (t.description) updateFields.description = t.description;
      if (t.seller) updateFields.seller = t.seller;

      if (Object.keys(updateFields).length > 0) {
        await supabaseAdmin.from('search_results').update(updateFields).eq('id', result.id);
        updated++;
      }
    }

    return NextResponse.json({
      message: `Traduction terminée: ${updated}/${results.length} résultats mis à jour`,
      total: results.length,
      updated,
    });
  } catch (err) {
    console.error('Translate route error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
