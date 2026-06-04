import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { translateNote } from '@/lib/kimi/translate-note';

export const maxDuration = 30;

// POST: public-by-UUID — translate a note via Kimi (FR -> EN + ZH) and cache
// both translations on the row. Returns the updated row. Subsequent calls are
// no-ops if both translations already exist.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string; noteId: string }> },
) {
  try {
    const { uuid, noteId } = await params;

    const { data: note, error: nErr } = await supabaseAdmin
      .from('order_notes')
      .select('id, request_id, message, source_lang, message_en, message_zh')
      .eq('id', noteId)
      .single();
    if (nErr || !note) {
      return NextResponse.json({ error: 'Note introuvable' }, { status: 404 });
    }
    if (note.request_id !== uuid) {
      return NextResponse.json({ error: 'Note hors de cette commande' }, { status: 403 });
    }

    if (note.message_en && note.message_zh) {
      return NextResponse.json(note);
    }

    let translations;
    try {
      translations = await translateNote(note.message);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Erreur traduction' },
        { status: 502 },
      );
    }

    const { data: updated, error: uErr } = await supabaseAdmin
      .from('order_notes')
      .update({
        message_en: note.message_en || translations.en,
        message_zh: note.message_zh || translations.zh,
      })
      .eq('id', noteId)
      .select('id, author, message, source_lang, message_en, message_zh, created_at')
      .single();
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('order-summary note translate error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
