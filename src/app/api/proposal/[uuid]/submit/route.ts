import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: Public endpoint — client submits their final picks & quantities
// Body: { picks: [{ result_id, client_selected, client_quantity }] }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const { picks } = await request.json();

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

    // Verify each result actually belongs to this request
    // (prevent clients from updating unrelated rows)
    const { data: validResults } = await supabaseAdmin
      .from('request_items')
      .select('id, search_results(id)')
      .eq('request_id', uuid);

    interface RawRow {
      id: string;
      search_results: { id: string }[];
    }
    const validRows = (validResults || []) as unknown as RawRow[];
    const validIds = new Set(
      validRows.flatMap((i) => (i.search_results || []).map((r) => r.id))
    );

    // Apply updates one by one
    let updated = 0;
    for (const pick of picks) {
      if (!pick?.result_id || !validIds.has(pick.result_id)) continue;

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
        updated++;
      }
    }

    // Mark request as reviewed by client
    await supabaseAdmin
      .from('requests')
      .update({ status: 'client_reviewed' })
      .eq('id', uuid);

    return NextResponse.json({
      message: `Choix enregistrés: ${updated} produit(s)`,
      updated,
    });
  } catch (err) {
    console.error('Proposal submit error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
