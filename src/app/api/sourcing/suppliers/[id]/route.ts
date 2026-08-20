import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import {
  badRequest, dbError, normalizeNumeric, normalizeText, notFound, pickAllowed, unauthorized,
} from '@/lib/sourcing/api';

const SUPPLIER_FIELDS = [
  'ext_id', 'position', 'name', 'legal_name', 'registration', 'country', 'track',
  'verdict', 'verdict_label', 'strengths', 'weaknesses', 'warnings', 'contacts',
  'default_currency', 'known_moq', 'solidity', 'included',
] as const;

const SUPPLIER_TEXT = [
  'ext_id', 'legal_name', 'registration', 'country', 'track', 'verdict',
  'verdict_label', 'strengths', 'weaknesses', 'default_currency',
] as const;

const SUPPLIER_NUMERIC = ['known_moq', 'solidity', 'position'] as const;

// PATCH: fiche fournisseur (due diligence, coordonnées, inclusion au panel).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const patch = normalizeNumeric(
    normalizeText(pickAllowed(body, SUPPLIER_FIELDS), SUPPLIER_TEXT),
    SUPPLIER_NUMERIC,
  );
  if (!Object.keys(patch).length) return badRequest('Aucun champ à mettre à jour');

  if ('name' in patch && (typeof patch.name !== 'string' || !patch.name.trim())) {
    return badRequest('Nom du fournisseur requis');
  }
  if (patch.solidity != null) {
    const s = Number(patch.solidity);
    if (!Number.isFinite(s) || s < 0 || s > 100) return badRequest('Solidité attendue entre 0 et 100');
  }

  const { data, error } = await supabaseAdmin
    .from('sourcing_suppliers')
    .update(patch)
    .eq('id', id)
    .select('*, sourcing_quotes(*)')
    .single();
  if (error) return dbError('suppliers.patch', error);
  if (!data) return notFound('Fournisseur');
  return NextResponse.json(data);
}

// DELETE: retire le fournisseur du panel. La réponse au devis part en cascade.
// Pour conserver la trace d'un fournisseur écarté, préférer included = false.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const { error } = await supabaseAdmin.from('sourcing_suppliers').delete().eq('id', id);
  if (error) return dbError('suppliers.delete', error);
  return NextResponse.json({ success: true });
}
