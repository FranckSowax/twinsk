import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { badRequest, dbError, normalizeText, pickAllowed, unauthorized } from '@/lib/sourcing/api';

const SUPPLIER_FIELDS = [
  'ext_id', 'position', 'name', 'legal_name', 'registration', 'country', 'track',
  'verdict', 'verdict_label', 'strengths', 'weaknesses', 'warnings', 'contacts',
  'default_currency', 'known_moq', 'solidity', 'included',
] as const;

const SUPPLIER_TEXT = [
  'ext_id', 'legal_name', 'registration', 'country', 'track', 'verdict',
  'verdict_label', 'strengths', 'weaknesses', 'default_currency',
] as const;

// POST: ajout d'un fournisseur au panel. Sa réponse au devis est créée vierge :
// tous les champs chiffrés à null, aucun zéro implicite.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const patch = normalizeText(pickAllowed(body, SUPPLIER_FIELDS), SUPPLIER_TEXT);

  if (typeof patch.name !== 'string' || !patch.name.trim()) {
    return badRequest('Nom du fournisseur requis');
  }
  patch.name = patch.name.trim();

  if (patch.position == null) {
    const { count } = await supabaseAdmin
      .from('sourcing_suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id);
    patch.position = count ?? 0;
  }

  const { data, error } = await supabaseAdmin
    .from('sourcing_suppliers')
    .insert({ project_id: id, ...patch })
    .select()
    .single();
  if (error || !data) return dbError('suppliers.create', error);

  const { error: quoteErr } = await supabaseAdmin
    .from('sourcing_quotes')
    .insert({ supplier_id: data.id });
  if (quoteErr) return dbError('suppliers.create.quote', quoteErr);

  return NextResponse.json({ ...data, quote: null });
}
