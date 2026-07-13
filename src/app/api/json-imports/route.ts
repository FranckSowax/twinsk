import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';

// GET: liste des JSON importés pour une cible (offre/demande).
// Query: ?target_type=offer|request&target_id=<uuid>
export async function GET(request: NextRequest) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const type = request.nextUrl.searchParams.get('target_type');
  const id = request.nextUrl.searchParams.get('target_id');
  if ((type !== 'offer' && type !== 'request') || !id) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('json_imports')
    .select('id, created_at, label, product_count') // sans payload (léger)
    .eq('target_type', type)
    .eq('target_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ imports: [], warning: error.message });
  return NextResponse.json({ imports: data || [] });
}
