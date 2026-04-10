import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: Create a note on a request_item (admin or client)
// Body: { request_item_id, author, message?, media_urls? }
export async function POST(request: NextRequest) {
  try {
    const { request_item_id, author, message, media_urls } = await request.json();

    if (!request_item_id) {
      return NextResponse.json({ error: 'request_item_id requis' }, { status: 400 });
    }

    if (!message?.trim() && (!media_urls || !media_urls.length)) {
      return NextResponse.json({ error: 'Un message ou un média est requis' }, { status: 400 });
    }

    // Determine author — admin needs valid cookie
    const adminCookie = request.cookies.get('admin_token');
    const isAdmin = adminCookie?.value === process.env.ADMIN_PASSWORD;
    const finalAuthor = author === 'admin' && isAdmin ? 'admin' : 'client';

    const { data, error } = await supabaseAdmin
      .from('item_notes')
      .insert({
        request_item_id,
        author: finalAuthor,
        message: message?.trim() || null,
        media_urls: media_urls?.length ? media_urls : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE: Remove a note (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('item_notes').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
