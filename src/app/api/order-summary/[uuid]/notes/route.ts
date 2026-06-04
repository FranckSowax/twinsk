import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: public-by-UUID — create a new collaborator note attached to a request.
// Used by /order-summary to log a fil d historique sur la fiche commande.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;
    const body = (await request.json()) as { author?: unknown; message?: unknown };
    const author = typeof body.author === 'string' && body.author.trim().length > 0
      ? body.author.trim().slice(0, 80)
      : 'collaborateur';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 });
    }

    // Verify the request exists before inserting.
    const { data: req, error: reqErr } = await supabaseAdmin
      .from('requests')
      .select('id')
      .eq('id', uuid)
      .single();
    if (reqErr || !req) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('order_notes')
      .insert({ request_id: uuid, author, message, source_lang: 'fr' })
      .select('id, author, message, source_lang, message_en, message_zh, created_at')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('order-summary note POST error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
