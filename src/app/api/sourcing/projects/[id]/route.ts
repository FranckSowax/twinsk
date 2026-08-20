import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { badRequest, dbError, notFound, pickAllowed, unauthorized } from '@/lib/sourcing/api';

// GET: projet complet, tout imbriqué (panel, réponses, conditions, journal, annexes, liens).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  // Le cockpit s'ouvre sur une URL lisible : on accepte l'identifiant comme le slug.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: project, error } = await supabaseAdmin
    .from('sourcing_projects')
    .select('*')
    .eq(isUuid ? 'id' : 'slug', id)
    .single();
  if (error || !project) return notFound('Projet');

  const [suppliers, conditions, log, images, shares] = await Promise.all([
    supabaseAdmin
      .from('sourcing_suppliers')
      .select('*, sourcing_quotes(*)')
      .eq('project_id', project.id)
      .order('position'),
    supabaseAdmin.from('sourcing_conditions').select('*').eq('project_id', project.id).order('position'),
    supabaseAdmin
      .from('sourcing_contact_log')
      .select('*')
      .eq('project_id', project.id)
      .order('happened_on', { ascending: false }),
    supabaseAdmin.from('sourcing_images').select('*').eq('project_id', project.id).order('position'),
    supabaseAdmin
      .from('sourcing_shares')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
  ]);

  const firstError =
    suppliers.error || conditions.error || log.error || images.error || shares.error;
  if (firstError) return dbError('projects.get', firstError);

  return NextResponse.json({
    project,
    suppliers: (suppliers.data || []).map((s) => {
      const { sourcing_quotes: quote, ...supplier } = s as Record<string, unknown> & {
        sourcing_quotes?: unknown;
      };
      return { ...supplier, quote: quote ?? null };
    }),
    conditions: conditions.data || [],
    log: log.data || [],
    // L'URL publique est dérivée du storage_key ici : le client n'a pas à
    // reconstruire un chemin de stockage à la main.
    images: (images.data || []).map((img) => ({
      ...img,
      url: supabaseAdmin.storage.from('request-images').getPublicUrl(img.storage_key).data
        .publicUrl,
    })),
    shares: shares.data || [],
  });
}

const PROJECT_FIELDS = [
  'title', 'client', 'buyer', 'status', 'slug',
  'spec', 'market_finding', 'params', 'weights', 'decision',
] as const;

// PATCH: mise à jour du projet (allowlist explicite).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const patch = pickAllowed(body, PROJECT_FIELDS);
  if (!Object.keys(patch).length) return badRequest('Aucun champ à mettre à jour');

  if ('title' in patch && (typeof patch.title !== 'string' || !patch.title.trim())) {
    return badRequest('Titre requis');
  }
  if (
    'status' in patch &&
    !['draft', 'active', 'decided', 'archived'].includes(String(patch.status))
  ) {
    return badRequest('Statut invalide');
  }

  const { data, error } = await supabaseAdmin
    .from('sourcing_projects')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return dbError('projects.patch', error);
  if (!data) return notFound('Projet');
  return NextResponse.json(data);
}

// DELETE: archivage, jamais de suppression physique — un dossier de sourcing se conserve.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('sourcing_projects')
    .update({ status: 'archived' })
    .eq('id', id)
    .select('id, status')
    .single();
  if (error) return dbError('projects.archive', error);
  if (!data) return notFound('Projet');
  return NextResponse.json({ success: true, ...data });
}
