import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

// GET: List all offers (admin only)
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('offers')
    .select('*, offer_items(count), offer_orders(count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: Create a new offer (admin only)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { title, theme, description } = body as {
    title?: string;
    theme?: string;
    description?: string;
  };

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('offers')
    .insert({
      title: title.trim(),
      theme: theme?.trim() || null,
      description: description?.trim() || null,
      status: 'draft',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
