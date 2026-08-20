import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import {
  badRequest, dbError, normalizeText, notFound, pickAllowed, unauthorized,
} from '@/lib/sourcing/api';

const FIELDS = ['title', 'detail', 'state', 'resolved_on', 'evidence', 'position'] as const;
const TEXT = ['title', 'detail', 'state', 'resolved_on', 'evidence'] as const;

// PATCH: état d'une condition suspensive. null = non statué.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const patch = normalizeText(pickAllowed(body, FIELDS), TEXT);
  if (!Object.keys(patch).length) return badRequest('Aucun champ à mettre à jour');

  if ('state' in patch && patch.state != null && !['oui', 'non', 'na'].includes(String(patch.state))) {
    return badRequest('État de condition invalide');
  }

  const { data, error } = await supabaseAdmin
    .from('sourcing_conditions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return dbError('conditions.patch', error);
  if (!data) return notFound('Condition');
  return NextResponse.json(data);
}
