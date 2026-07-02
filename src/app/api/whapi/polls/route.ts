import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: liste des sondages WhatsApp et leurs résultats (admin only).
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('admin_token');
  if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('whapi_polls')
    .select('id, title, results, total_votes, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) {
    // Table absente (migration 22 non appliquée) → liste vide plutôt qu'une 500.
    return NextResponse.json({ polls: [], warning: error.message });
  }
  return NextResponse.json({ polls: data || [] });
}
