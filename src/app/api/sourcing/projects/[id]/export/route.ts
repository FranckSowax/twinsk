import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { dbError, notFound, unauthorized } from '@/lib/sourcing/api';
import { toCockpitFile } from '@/lib/sourcing/htmlBridge';
import type { SourcingQuote, SourcingSupplier } from '@/lib/sourcing/types';

/**
 * GET: export au format du cockpit autonome, réimportable dans le fichier HTML.
 *
 * Le fichier ne transporte ni les images ni l'identité des fournisseurs : le
 * cockpit ne gère pas les premières et porte la seconde en dur dans son code.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: project, error } = await supabaseAdmin
    .from('sourcing_projects')
    .select('*')
    .eq(isUuid ? 'id' : 'slug', id)
    .single();
  if (error || !project) return notFound('Projet');

  const [suppliers, conditions, log] = await Promise.all([
    supabaseAdmin
      .from('sourcing_suppliers')
      .select('*, sourcing_quotes(*)')
      .eq('project_id', project.id)
      .order('position'),
    supabaseAdmin
      .from('sourcing_conditions')
      .select('*')
      .eq('project_id', project.id)
      .order('position'),
    supabaseAdmin
      .from('sourcing_contact_log')
      .select('*')
      .eq('project_id', project.id)
      .order('happened_on'),
  ]);
  if (suppliers.error || conditions.error || log.error) {
    return dbError('export.load', suppliers.error ?? conditions.error ?? log.error);
  }

  const file = toCockpitFile({
    project,
    suppliers: (suppliers.data || []).map((row) => {
      const { sourcing_quotes: quote, ...supplier } = row as SourcingSupplier & {
        sourcing_quotes: SourcingQuote | null;
      };
      return { supplier: supplier as SourcingSupplier, quote: quote ?? null };
    }),
    conditions: conditions.data || [],
    log: log.data || [],
  });

  const stamp = new Date(project.updated_at).toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="cockpit_${project.slug}_${stamp}.json"`,
    },
  });
}
