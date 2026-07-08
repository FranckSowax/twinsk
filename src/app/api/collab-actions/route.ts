import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

// GET: journal d'audit des actions collaborateurs (admin only).
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { searchParams } = request.nextUrl;
  const collaboratorId = searchParams.get('collaborator_id');
  let query = supabaseAdmin
    .from('collab_actions')
    .select('id, collaborator_name, action, target_type, target_id, description, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (collaboratorId) query = query.eq('collaborator_id', collaboratorId);
  const { data, error } = await query;
  if (error) {
    // Table absente (migration 23 non appliquée) → liste vide plutôt qu'une 500.
    return NextResponse.json({ actions: [], warning: error.message });
  }
  return NextResponse.json({ actions: data || [] });
}
