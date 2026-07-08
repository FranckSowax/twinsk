import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';

// POST: Create a new request — open to clients (LP) and admins.
// Accepts: { client_name?, client_email?, client_phone?, notes? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { client_name, client_email, client_phone, notes } = body as {
      client_name?: string;
      client_email?: string;
      client_phone?: string;
      notes?: string;
    };

    const { data, error } = await supabaseAdmin
      .from('requests')
      .insert({
        client_name: (client_name ?? '').trim(),
        client_email: (client_email ?? '').trim(),
        client_phone: (client_phone ?? '').trim(),
        notes: notes?.trim() || null,
        status: 'draft',
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

// GET: List all requests (admin)
export async function GET(request: NextRequest) {
  try {
    if (!(await resolveActor(request))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('requests')
      .select('*, request_items(id, description, search_results(title))')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
