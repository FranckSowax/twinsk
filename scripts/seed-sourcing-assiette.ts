/**
 * Amorçage du projet « Assiette 9″ 3 compartiments à couvercle twist-lock ».
 *
 *   npx tsx scripts/seed-sourcing-assiette.ts
 *
 * Nécessite NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans
 * l'environnement, et la migration 47 appliquée.
 *
 * IDEMPOTENT : relancé, il met à jour sans dupliquer. L'appariement se fait par
 * slug pour le projet, par (projet, ext_id) pour les fournisseurs et par
 * (projet, position) pour les conditions.
 *
 * Ce script ne touche JAMAIS aux réponses déjà saisies : il crée un devis vierge
 * quand il n'y en a pas et laisse intact celui qui existe. Relancer l'amorçage
 * après une consultation n'efface donc aucun prix ni délai reçu.
 */

import { supabaseAdmin } from '../src/lib/supabase/server';
import {
  ASSIETTE_CONDITIONS,
  ASSIETTE_DECISION,
  ASSIETTE_MARKET,
  ASSIETTE_PROJECT,
  ASSIETTE_SLUG,
  ASSIETTE_SPEC,
  ASSIETTE_SUPPLIERS,
} from '../src/lib/sourcing/seed-data';

function die(step: string, error: unknown): never {
  console.error(`✗ ${step}`, error);
  process.exit(1);
}

async function main() {
  console.log('Amorçage du projet de sourcing « assiette 9″ twist-lock »…\n');

  /* ── Projet ────────────────────────────────────────────── */
  const { data: existing } = await supabaseAdmin
    .from('sourcing_projects')
    .select('id')
    .eq('slug', ASSIETTE_SLUG)
    .maybeSingle();

  const projectPayload = {
    slug: ASSIETTE_SLUG,
    title: ASSIETTE_PROJECT.title,
    client: ASSIETTE_PROJECT.client,
    buyer: ASSIETTE_PROJECT.buyer,
    spec: { rows: ASSIETTE_SPEC },
    market_finding: { blocks: ASSIETTE_MARKET },
  };

  let projectId: string;
  if (existing) {
    // La décision et le statut appartiennent à l'utilisateur : on ne les réécrit
    // pas sur un projet déjà ouvert.
    const { error } = await supabaseAdmin
      .from('sourcing_projects')
      .update(projectPayload)
      .eq('id', existing.id);
    if (error) die('mise à jour du projet', error);
    projectId = existing.id;
    console.log('· projet mis à jour');
  } else {
    const { data, error } = await supabaseAdmin
      .from('sourcing_projects')
      .insert({
        ...projectPayload,
        status: 'active',
        decision: { question: ASSIETTE_DECISION.question, options: ASSIETTE_DECISION.options },
      })
      .select('id')
      .single();
    if (error || !data) die('création du projet', error);
    projectId = data.id;
    console.log('· projet créé');
  }

  /* ── Fournisseurs ──────────────────────────────────────── */
  const { data: currentSuppliers, error: loadErr } = await supabaseAdmin
    .from('sourcing_suppliers')
    .select('id, ext_id')
    .eq('project_id', projectId);
  if (loadErr) die('lecture du panel', loadErr);

  const byExtId = new Map(
    (currentSuppliers || []).filter((s) => s.ext_id).map((s) => [s.ext_id as string, s.id]),
  );

  let created = 0;
  let updated = 0;

  for (const s of ASSIETTE_SUPPLIERS) {
    const payload = {
      project_id: projectId,
      ext_id: s.ext_id,
      position: s.position,
      name: s.name,
      country: s.country,
      track: s.track,
      verdict: s.verdict,
      verdict_label: s.verdict_label,
      registration: s.registration,
      strengths: s.strengths,
      weaknesses: s.weaknesses,
      warnings: s.warnings,
      default_currency: s.default_currency,
      known_moq: s.known_moq,
      solidity: s.solidity,
      included: s.included,
    };

    const existingId = byExtId.get(s.ext_id);
    let supplierId: string;

    if (existingId) {
      const { error } = await supabaseAdmin
        .from('sourcing_suppliers')
        .update(payload)
        .eq('id', existingId);
      if (error) die(`mise à jour de ${s.ext_id}`, error);
      supplierId = existingId;
      updated++;
    } else {
      const { data, error } = await supabaseAdmin
        .from('sourcing_suppliers')
        .insert(payload)
        .select('id')
        .single();
      if (error || !data) die(`création de ${s.ext_id}`, error);
      supplierId = data.id;
      created++;
    }

    // Devis : créé vierge s'il n'existe pas, jamais écrasé s'il existe.
    const { data: quote } = await supabaseAdmin
      .from('sourcing_quotes')
      .select('supplier_id')
      .eq('supplier_id', supplierId)
      .maybeSingle();

    if (!quote) {
      const { error } = await supabaseAdmin.from('sourcing_quotes').insert({
        supplier_id: supplierId,
        // Le MOQ documenté en due diligence préremplit le champ, comme dans le
        // cockpit. Tous les autres champs chiffrés restent null.
        moq: s.known_moq,
        status: s.status,
      });
      if (error) die(`création du devis de ${s.ext_id}`, error);
    }
  }

  console.log(`· fournisseurs : ${created} créés, ${updated} mis à jour`);

  /* ── Conditions suspensives ────────────────────────────── */
  const { data: currentConditions } = await supabaseAdmin
    .from('sourcing_conditions')
    .select('id, position')
    .eq('project_id', projectId);
  const byPosition = new Map((currentConditions || []).map((c) => [c.position, c.id]));

  let condCreated = 0;
  let condUpdated = 0;
  for (const c of ASSIETTE_CONDITIONS) {
    const id = byPosition.get(c.position);
    if (id) {
      // L'état, la date et la preuve sont saisis par l'utilisateur : intouchés.
      const { error } = await supabaseAdmin
        .from('sourcing_conditions')
        .update({ title: c.title, detail: c.detail })
        .eq('id', id);
      if (error) die(`mise à jour de la condition ${c.position}`, error);
      condUpdated++;
    } else {
      const { error } = await supabaseAdmin.from('sourcing_conditions').insert({
        project_id: projectId,
        position: c.position,
        title: c.title,
        detail: c.detail,
      });
      if (error) die(`création de la condition ${c.position}`, error);
      condCreated++;
    }
  }

  console.log(`· conditions : ${condCreated} créées, ${condUpdated} mises à jour`);

  const ecartes = ASSIETTE_SUPPLIERS.filter((s) => !s.included).map((s) => s.ext_id);
  const alertes = ASSIETTE_SUPPLIERS.filter((s) => s.warnings.length).length;

  console.log(`\n✓ Terminé — ${ASSIETTE_SUPPLIERS.length} fournisseurs au dossier.`);
  console.log(`  ${alertes} portent une alerte bloquante.`);
  if (ecartes.length) {
    console.log(
      `  Écarté${ecartes.length > 1 ? 's' : ''} mais conservé${ecartes.length > 1 ? 's' : ''} au dossier : ${ecartes.join(', ')}`,
    );
  }
  console.log(`\n  → /admin/sourcing/${ASSIETTE_SLUG}`);
}

main().catch((e) => die('amorçage', e));
