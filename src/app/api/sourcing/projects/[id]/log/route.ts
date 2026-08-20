import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { badRequest, dbError, normalizeText, pickAllowed, unauthorized } from '@/lib/sourcing/api';

const FIELDS = ['supplier_id', 'happened_on', 'channel', 'contact_name', 'subject', 'outcome'] as const;
const TEXT = ['happened_on', 'channel', 'contact_name', 'subject', 'outcome'] as const;

// POST: ligne de journal de contact.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const patch = normalizeText(pickAllowed(body, FIELDS), TEXT);
  if (!Object.keys(patch).length) return badRequest('Ligne de journal vide');

  const { data, error } = await supabaseAdmin
    .from('sourcing_contact_log')
    .insert({ project_id: id, ...patch })
    .select()
    .single();
  if (error) return dbError('log.create', error);
  return NextResponse.json(data);
}
