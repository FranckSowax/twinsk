import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { badRequest, dbError, notFound, pickAllowed, slugify, unauthorized } from '@/lib/sourcing/api';
import { computeProject } from '@/lib/sourcing/compute';
import { DEFAULT_PARAMS, DEFAULT_WEIGHTS } from '@/lib/sourcing/defaults';
import type { SourcingProject, SourcingQuote, SourcingSupplier } from '@/lib/sourcing/types';

/** Réserve un slug libre : suffixe -2, -3… en cas de collision. */
async function freeSlug(base: string): Promise<string> {
  const root = slugify(base);
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const { data } = await supabaseAdmin
      .from('sourcing_projects')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now()}`;
}

// GET: liste des projets, avec l'avancement de chaque consultation.
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('sourcing_projects')
    .select('*, sourcing_suppliers(*, sourcing_quotes(*))')
    .order('updated_at', { ascending: false });
  if (error) return dbError('projects.list', error);

  type Row = Record<string, unknown> & {
    params?: SourcingProject['params'];
    weights?: SourcingProject['weights'];
    sourcing_suppliers?: Array<SourcingSupplier & { sourcing_quotes: SourcingQuote | null }>;
  };

  const projects = ((data || []) as Row[]).map((row) => {
    const { sourcing_suppliers: suppliers, ...project } = row;
    const entries = (suppliers ?? []).map((s) => {
      const { sourcing_quotes: quote, ...supplier } = s;
      return { supplier: supplier as SourcingSupplier, quote: quote ?? null };
    });
    const result = computeProject({
      params: project.params ?? DEFAULT_PARAMS,
      weights: project.weights ?? DEFAULT_WEIGHTS,
      entries,
    });
    return {
      ...project,
      supplier_count: entries.length,
      kpis: result.kpis,
      leader: result.ranked[0]
        ? { name: result.ranked[0].supplier.name, score: result.ranked[0].score }
        : null,
    };
  });

  return NextResponse.json(projects);
}

// POST: création d'un projet, ou duplication d'un projet existant.
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { title, client, buyer, duplicate_from } = body as {
    title?: string;
    client?: string;
    buyer?: string;
    duplicate_from?: string;
  };

  if (!title || !title.trim()) return badRequest('Titre requis');

  // ---- Duplication ----
  // On reprend le cadre de la consultation (cahier des charges, paramètres, panel,
  // conditions) mais AUCUNE réponse fournisseur : une duplication ouvre une nouvelle
  // consultation, les devis repartent vierges.
  if (duplicate_from) {
    const { data: source, error: srcErr } = await supabaseAdmin
      .from('sourcing_projects')
      .select('*, sourcing_suppliers(*), sourcing_conditions(*)')
      .eq('id', duplicate_from)
      .single();
    if (srcErr || !source) return notFound('Projet source');

    const { data: created, error: insErr } = await supabaseAdmin
      .from('sourcing_projects')
      .insert({
        slug: await freeSlug(title),
        title: title.trim(),
        client: client?.trim() || source.client,
        buyer: buyer?.trim() || source.buyer,
        status: 'draft',
        spec: source.spec,
        market_finding: source.market_finding,
        params: source.params,
        weights: source.weights,
      })
      .select()
      .single();
    if (insErr || !created) return dbError('projects.duplicate', insErr);

    const suppliers = (source.sourcing_suppliers || []) as SourcingSupplier[];
    if (suppliers.length) {
      const { data: copies, error: supErr } = await supabaseAdmin
        .from('sourcing_suppliers')
        .insert(
          suppliers.map((s) => ({
            project_id: created.id,
            ext_id: s.ext_id,
            position: s.position,
            name: s.name,
            legal_name: s.legal_name,
            registration: s.registration,
            country: s.country,
            track: s.track,
            verdict: s.verdict,
            verdict_label: s.verdict_label,
            strengths: s.strengths,
            weaknesses: s.weaknesses,
            warnings: s.warnings,
            contacts: s.contacts,
            default_currency: s.default_currency,
            known_moq: s.known_moq,
            solidity: s.solidity,
            included: s.included,
          })),
        )
        .select('id');
      if (supErr) return dbError('projects.duplicate.suppliers', supErr);
      if (copies?.length) {
        const { error: qErr } = await supabaseAdmin
          .from('sourcing_quotes')
          .insert(copies.map((c) => ({ supplier_id: c.id })));
        if (qErr) return dbError('projects.duplicate.quotes', qErr);
      }
    }

    const conditions = (source.sourcing_conditions || []) as Array<{
      position: number;
      title: string;
      detail: string | null;
    }>;
    if (conditions.length) {
      // Titres et détails repris, états remis à zéro : rien n'est levé d'avance.
      const { error: condErr } = await supabaseAdmin.from('sourcing_conditions').insert(
        conditions.map((c) => ({
          project_id: created.id,
          position: c.position,
          title: c.title,
          detail: c.detail,
        })),
      );
      if (condErr) return dbError('projects.duplicate.conditions', condErr);
    }

    return NextResponse.json(created);
  }

  // ---- Création vierge ----
  const patch = pickAllowed(body, ['spec', 'market_finding', 'params', 'weights'] as const);
  const { data, error } = await supabaseAdmin
    .from('sourcing_projects')
    .insert({
      slug: await freeSlug(title),
      title: title.trim(),
      client: client?.trim() || null,
      buyer: buyer?.trim() || null,
      status: 'draft',
      ...patch,
    })
    .select()
    .single();
  if (error) return dbError('projects.create', error);
  return NextResponse.json(data);
}
