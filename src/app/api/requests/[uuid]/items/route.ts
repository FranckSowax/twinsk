import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: Add items to a request (client submits images + descriptions)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const { items } = await request.json();

    if (!items?.length) {
      return NextResponse.json({ error: 'Aucun article fourni' }, { status: 400 });
    }

    const insertData = items.map((item: { image_url: string; description?: string }) => ({
      request_id: uuid,
      image_url: item.image_url,
      description: item.description || null,
    }));

    const { data, error } = await supabaseAdmin
      .from('request_items')
      .insert(insertData)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update request status to submitted
    await supabaseAdmin
      .from('requests')
      .update({ status: 'submitted' })
      .eq('id', uuid);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
