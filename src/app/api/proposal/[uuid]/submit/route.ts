import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: Public endpoint — client submits their final picks, quantities AND notes
// Body: {
//   picks: [{ result_id, client_selected, client_quantity }],
//   notes: [{ item_id, note }]  // per-request_item notes (required if no product is selected for this item)
// }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const { picks, notes } = await request.json();

    if (!Array.isArray(picks)) {
      return NextResponse.json({ error: 'picks[] requis' }, { status: 400 });
    }

    // Verify the request exists
    const { data: existingRequest } = await supabaseAdmin
      .from('requests')
      .select('id')
      .eq('id', uuid)
      .single();

    if (!existingRequest) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
    }

    // Load items + their search results to (a) scope updates (b) validate notes
    const { data: itemsRaw } = await supabaseAdmin
      .from('request_items')
      .select('id, search_results(id, selected)')
      .eq('request_id', uuid);

    interface ItemWithResults {
      id: string;
      search_results: { id: string; selected: boolean }[];
    }
    const itemRows = (itemsRaw || []) as unknown as ItemWithResults[];

    const validResultIds = new Set(
      itemRows.flatMap((i) => (i.search_results || []).map((r) => r.id))
    );

    // Apply result-level updates
    let updatedResults = 0;
    for (const pick of picks) {
      if (!pick?.result_id || !validResultIds.has(pick.result_id)) continue;

      const updateFields: Record<string, unknown> = {};
      if (typeof pick.client_selected === 'boolean') {
        updateFields.client_selected = pick.client_selected;
      }
      if (pick.client_quantity != null) {
        const qty = Number(pick.client_quantity);
        if (!isNaN(qty) && qty >= 0) updateFields.client_quantity = qty;
      }

      if (Object.keys(updateFields).length > 0) {
        await supabaseAdmin
          .from('search_results')
          .update(updateFields)
          .eq('id', pick.result_id);
        updatedResults++;
      }
    }

    // Apply notes + validate: if client selected zero products for an item that has results,
    // they must leave a note explaining why.
    const noteMap = new Map<string, string>(
      Array.isArray(notes)
        ? notes
            .filter((n: { item_id?: string; note?: string }) => n?.item_id)
            .map((n: { item_id: string; note?: string }) => [n.item_id, (n.note || '').trim()])
        : []
    );

    // Build the final selection state per item using the new picks
    const pickByResult = new Map<string, boolean>();
    for (const p of picks) {
      if (typeof p?.client_selected === 'boolean') {
        pickByResult.set(p.result_id, p.client_selected);
      }
    }

    for (const item of itemRows) {
      const itemResults = item.search_results || [];
      // Only enforce for items that actually had proposed results
      if (itemResults.length === 0) continue;

      // Compute selection count after picks applied
      const selectedCount = itemResults.filter((r) => {
        const override = pickByResult.get(r.id);
        if (override !== undefined) return override;
        return r.selected; // fall back to previous admin selection
      }).length;

      const note = noteMap.get(item.id) ?? null;

      if (selectedCount === 0 && !note) {
        return NextResponse.json(
          {
            error:
              "Merci de laisser une note pour chaque article où vous n'avez sélectionné aucune proposition",
            item_id: item.id,
          },
          { status: 400 }
        );
      }

      // Save the note (null if empty)
      await supabaseAdmin
        .from('request_items')
        .update({ client_note: note || null })
        .eq('id', item.id);
    }

    // Mark request as reviewed by client
    await supabaseAdmin
      .from('requests')
      .update({ status: 'client_reviewed' })
      .eq('id', uuid);

    return NextResponse.json({
      message: `Choix enregistrés: ${updatedResults} produit(s)`,
      updated: updatedResults,
    });
  } catch (err) {
    console.error('Proposal submit error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
