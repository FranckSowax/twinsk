import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import {
  badRequest, dbError, normalizeNumeric, normalizeText, pickAllowed, unauthorized,
} from '@/lib/sourcing/api';

const QUOTE_FIELDS = [
  'status', 'contact_name', 'channel', 'sent_at', 'replied_at',
  'twist_lock', 'twist_proof', 'dfm_notes',
  'currency', 'price_5k', 'price_10k', 'price_20k', 'moq',
  'mould_plate_cost', 'mould_lid_cost', 'cavities', 'mould_life_cycles', 'mould_ownership',
  'sample_cost', 'sample_days', 'tooling_days', 'production_days',
  'sets_per_carton', 'carton_volume_m3', 'carton_weight_kg', 'port', 'incoterm',
  'cert_fda', 'cert_lfgb', 'cert_iso', 'cert_migration',
  'payment_terms', 'notes',
] as const;

/**
 * Champs chiffrés. Une chaîne vide y devient null, jamais 0 : dans ce module,
 * zéro est une valeur mesurée et l'absence est une information différente.
 */
const QUOTE_NUMERIC = [
  'price_5k', 'price_10k', 'price_20k', 'moq',
  'mould_plate_cost', 'mould_lid_cost', 'mould_life_cycles',
  'sample_cost', 'sample_days', 'tooling_days', 'production_days',
  'sets_per_carton', 'carton_volume_m3', 'carton_weight_kg',
] as const;

const QUOTE_TEXT = [
  'contact_name', 'channel', 'sent_at', 'replied_at', 'twist_lock', 'twist_proof',
  'dfm_notes', 'currency', 'cavities', 'mould_ownership', 'port', 'incoterm',
  'payment_terms', 'notes',
] as const;

const STATUSES = ['a_contacter', 'contacte', 'relance', 'a_repondu', 'a_refuse', 'ecarte'];
const TWIST = ['refus', 'etude', 'oui_decl', 'oui_photo', 'oui_ref'];
const OWNERSHIP = ['acheteur', 'usine', 'partagee'];

// PATCH: réponse du fournisseur à la consultation.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const patch = normalizeNumeric(
    normalizeText(pickAllowed(body, QUOTE_FIELDS), QUOTE_TEXT),
    QUOTE_NUMERIC,
  );
  if (!Object.keys(patch).length) return badRequest('Aucun champ à mettre à jour');

  if ('status' in patch && !STATUSES.includes(String(patch.status))) {
    return badRequest('Statut de consultation invalide');
  }
  if ('twist_lock' in patch && patch.twist_lock != null && !TWIST.includes(String(patch.twist_lock))) {
    return badRequest('Valeur de faisabilité twist-lock invalide');
  }
  if (
    'mould_ownership' in patch &&
    patch.mould_ownership != null &&
    !OWNERSHIP.includes(String(patch.mould_ownership))
  ) {
    return badRequest('Propriété du moule invalide');
  }

  // upsert : le devis vierge est créé avec le fournisseur, mais un fournisseur
  // importé peut ne pas en avoir. La clé primaire est supplier_id.
  const { data, error } = await supabaseAdmin
    .from('sourcing_quotes')
    .upsert({ supplier_id: id, ...patch }, { onConflict: 'supplier_id' })
    .select()
    .single();
  if (error) return dbError('quotes.patch', error);
  return NextResponse.json(data);
}
