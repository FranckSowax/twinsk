import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';
import { FactoryImportError, parseDossier } from '@/lib/factories';

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

// Colonnes de la liste : tout sauf payload (un dossier pèse quelques centaines
// de Ko et la liste n'en a pas besoin).
const COLONNES_LISTE =
  'id, label, objet, marche_cible, devise, genere_le, factory_count, ecarte_count, created_at, updated_at';

// GET: liste des dossiers usines (admin OU collaborateur)
export async function GET(request: NextRequest) {
  if (!(await resolveActor(request))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('factory_dossiers')
    .select(COLONNES_LISTE)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: import d'un dossier JSON (admin uniquement).
// Corps accepté : le JSON du dossier lui-même, ou { label, payload }.
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON illisible' }, { status: 400 });
  }

  const enveloppe = body as { label?: unknown; payload?: unknown; usines?: unknown };
  const payload = Array.isArray(enveloppe.usines) ? body : enveloppe.payload;
  const label = typeof enveloppe.label === 'string' ? enveloppe.label : null;

  let parsed;
  try {
    parsed = parseDossier(payload, label);
  } catch (err) {
    const message =
      err instanceof FactoryImportError ? err.message : 'Dossier illisible';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: dossier, error } = await supabaseAdmin
    .from('factory_dossiers')
    .insert(parsed.dossier)
    .select('id, label, factory_count, ecarte_count')
    .single();
  if (error || !dossier) {
    return NextResponse.json({ error: error?.message || 'Erreur import' }, { status: 500 });
  }

  const lignes = parsed.factories.map((f) => ({ ...f, dossier_id: dossier.id }));
  const { error: erreurUsines } = await supabaseAdmin.from('factories').insert(lignes);
  if (erreurUsines) {
    // Un dossier sans ses usines n'a aucun intérêt : on le retire.
    await supabaseAdmin.from('factory_dossiers').delete().eq('id', dossier.id);
    return NextResponse.json({ error: erreurUsines.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    id: dossier.id,
    label: dossier.label,
    inserted: { usines: parsed.factories.length, ecartes: parsed.dossier.ecarte_count },
  });
}
