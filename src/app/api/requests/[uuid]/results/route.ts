import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Get all search results for a request
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

    // Get all request items with their search results
    const { data, error } = await supabaseAdmin
      .from('request_items')
      .select('*, search_results(*)')
      .eq('request_id', uuid)
      .order('created_at');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH: Update search results (select, quantity, margin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await params; // consume params

    const { updates } = await request.json();

    if (!updates?.length) {
      return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 });
    }

    for (const update of updates) {
      const { id, ...fields } = update;
      await supabaseAdmin
        .from('search_results')
        .update(fields)
        .eq('id', id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
