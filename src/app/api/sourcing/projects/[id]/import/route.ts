import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { badRequest, dbError, notFound, unauthorized } from '@/lib/sourcing/api';
import { fromCockpitFile } from '@/lib/sourcing/htmlBridge';

/**
 * POST: import d'un JSON exporté par le cockpit autonome.
 *
 * Le fichier ne porte pas l'identité des fournisseurs — le tableau SUP est en dur
 * dans le HTML. L'appariement se fait donc par ext_id, et l'import ne CRÉE aucun
 * fournisseur : il met à jour ceux du panel et signale les clés sans correspondant
 * plutôt que d'inventer des fiches vides.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Fichier illisible');

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: project } = await supabaseAdmin
    .from('sourcing_projects')
    .select('id')
    .eq(isUuid ? 'id' : 'slug', id)
    .maybeSingle();
  if (!project) return notFound('Projet');

  const parsed = fromCockpitFile(body);

  /* -- Projet -- */
  if (Object.keys(parsed.project).length) {
    const { error } = await supabaseAdmin
      .from('sourcing_projects')
      .update(parsed.project)
      .eq('id', project.id);
    if (error) return dbError('import.project', error);
  }

  /* -- Fournisseurs, appariés par ext_id -- */
  const { data: existing, error: supErr } = await supabaseAdmin
    .from('sourcing_suppliers')
    .select('id, ext_id')
    .eq('project_id', project.id);
  if (supErr) return dbError('import.suppliers.load', supErr);

  const byExtId = new Map(
    (existing || []).filter((s) => s.ext_id).map((s) => [s.ext_id as string, s.id]),
  );

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const [extId, patch] of Object.entries(parsed.suppliers)) {
    const supplierId = byExtId.get(extId);
    if (!supplierId) {
      skipped.push(extId);
      continue;
    }
    if (Object.keys(patch.supplier).length) {
      const { error } = await supabaseAdmin
        .from('sourcing_suppliers')
        .update(patch.supplier)
        .eq('id', supplierId);
      if (error) return dbError('import.supplier', error);
    }
    if (Object.keys(patch.quote).length) {
      const { error } = await supabaseAdmin
        .from('sourcing_quotes')
        .upsert({ supplier_id: supplierId, ...patch.quote }, { onConflict: 'supplier_id' });
      if (error) return dbError('import.quote', error);
    }
    updated.push(extId);
  }

  /* -- Conditions, appariées par position -- */
  const { data: conditions } = await supabaseAdmin
    .from('sourcing_conditions')
    .select('id, position')
    .eq('project_id', project.id)
    .order('position');
  const byPosition = new Map((conditions || []).map((c) => [c.position, c.id]));

  let conditionsUpdated = 0;
  for (const { position, patch } of parsed.conditions) {
    const conditionId = byPosition.get(position);
    if (!conditionId) continue;
    const { error } = await supabaseAdmin
      .from('sourcing_conditions')
      .update(patch)
      .eq('id', conditionId);
    if (error) return dbError('import.condition', error);
    conditionsUpdated++;
  }

  /* -- Journal : ajouté, jamais substitué à l'existant -- */
  const logRows = parsed.log.map((e) => ({
    project_id: project.id,
    supplier_id: e.supplierExtId ? (byExtId.get(e.supplierExtId) ?? null) : null,
    happened_on: e.happened_on ?? null,
    channel: e.channel ?? null,
    contact_name: e.contact_name ?? null,
    outcome: e.outcome ?? null,
  }));
  if (logRows.length) {
    const { error } = await supabaseAdmin.from('sourcing_contact_log').insert(logRows);
    if (error) return dbError('import.log', error);
  }

  return NextResponse.json({
    success: true,
    suppliers_updated: updated,
    // Clés du fichier sans fournisseur correspondant au panel : à créer à la main
    // si nécessaire, le fichier ne porte pas leur nom.
    suppliers_skipped: skipped,
    conditions_updated: conditionsUpdated,
    log_added: logRows.length,
  });
}
