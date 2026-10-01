// Onglet « Projets » — côté serveur (supabaseAdmin). Création depuis un
// modèle, lecture complète d'un projet, actions (tâches, journal, questions,
// documents, fournisseurs et échanges usines, devis, commandes, rapports,
// phases, liens client), audit dans project_events. Les fichiers vont dans
// le bucket PRIVÉ project-files et sont servis par liens signés.

import { randomBytes, randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { COUNTRY } from '@/config/countries';
import { buildPlan, canAdvanceOrder, canCompleteTask, canUnvalidateLine, canValidateLine, effectiveQuantity, initialPhases, lineTotal, scoreTotal, supplierAlias, toggleChecklist } from './logic';
import { buildRfqMessages, DEFAULT_RFQ_CONTEXT, quantitiesZhFromLines, rfqLotFor } from './rfq';
import { identifyingTokens, leaks, type ImportedSupplier } from './sourcing';
import { emailSender, parseRecipients, sendEmail } from '@/lib/email';
import { cleanRates, PROJECT_CURRENCIES, rateOf, rebaseRates, toBase, type Rates } from './fx';
import { templateByKey } from './templates/dom-tom';
import type { Attachment, ChecklistItem, ContactChannel, DocumentCategory, ExchangeChannel, OrderStatus, Phase, ProductPhoto, ProductSpec, ProjectTemplate, RfqContext, RfqOrigin, RfqSender, SampleStatus, Scores, SupplierStatus } from './types';

export const PROJECT_BUCKET = 'project-files';
export const SIGNED_URL_SECONDS = 900;

/** La partie Twinsk existe dans ce pays ? Sinon, aucune route projet ne répond. */
export function projectsEnabled(): boolean {
  return COUNTRY.modules.twinsk;
}

export interface Actor {
  kind: 'team' | 'client';
  id: string;
  name: string;
}

const now = () => new Date().toISOString();
const isMissing = (msg: string) => /does not exist|schema cache/i.test(msg);
export class ProjectError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
function fail(error: { message: string } | null, ctx: string): never {
  const msg = error?.message || ctx;
  throw new ProjectError(isMissing(msg) ? 'Migration « projects » non appliquée' : `${ctx} : ${msg}`, 500);
}

// ---- Audit ----
export interface EventInput {
  type: string;
  actor: Actor;
  target_type?: string;
  target_id?: string;
  detail?: string;
  data?: Record<string, unknown>;
  notify?: 'client' | 'team' | null;
}
export async function logEvent(projectId: string, e: EventInput): Promise<void> {
  const { error } = await supabaseAdmin.from('project_events').insert({
    project_id: projectId,
    type: e.type,
    actor: e.actor.kind === 'team' ? e.actor.id : `client:${e.actor.id}`,
    actor_name: e.actor.name,
    target_type: e.target_type || null,
    target_id: e.target_id || null,
    detail: e.detail || null,
    data: e.data || null,
    notify: e.notify || null,
  });
  if (error) console.error('[projects] événement non consigné :', error.message);
}

// ---- Projets ----
export async function listProjects() {
  const { data, error } = await supabaseAdmin.from('projects').select('id, title, client_name, client_company, currency, status, started_at, template_key, phases, updated_at').order('updated_at', { ascending: false });
  if (error) fail(error, 'Liste des projets');
  const projects = data || [];
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const [{ data: tasks }, { data: questions }, { data: events }] = await Promise.all([
    supabaseAdmin.from('project_tasks').select('project_id, status').in('project_id', ids),
    supabaseAdmin.from('project_questions').select('project_id').eq('status', 'open').in('project_id', ids),
    supabaseAdmin.from('project_events').select('project_id').eq('notify', 'team').is('seen_by_team_at', null).in('project_id', ids),
  ]);
  const count = (rows: { project_id: string }[] | null, id: string, f?: (r: { status?: string }) => boolean) => (rows || []).filter((r) => r.project_id === id && (!f || f(r as { status?: string }))).length;
  return projects.map((p) => ({
    ...p,
    tasks_total: count(tasks, p.id),
    tasks_done: count(tasks, p.id, (r) => r.status === 'done'),
    open_questions: count(questions, p.id),
    pending_team: count(events, p.id),
  }));
}

export interface CreateProjectArgs {
  title?: string;
  /** Devise principale du devis (dollar par défaut ; les prix restent saisis dans leur devise). */
  currency?: string;
  clientName?: string;
  clientCompany?: string;
  clientPhone?: string;
  clientEmail?: string;
  startedAt?: string;
  actor: Actor;
}
export async function createProjectFromTemplate(args: CreateProjectArgs & { templateKey: string }) {
  const t = templateByKey(args.templateKey);
  if (!t) throw new ProjectError('Modèle inconnu');
  return createProject(t, args, `Projet créé depuis le modèle « ${t.title} »`);
}
/** Projet créé depuis un plan proposé par l'IA (déjà validé par validateGeneratedTemplate). */
export async function createProjectFromGenerated(t: ProjectTemplate, args: CreateProjectArgs) {
  return createProject(t, args, 'Projet créé depuis un brief (plan proposé par l’IA, relu par l’équipe)');
}
async function createProject(t: ProjectTemplate, args: CreateProjectArgs, detail: string) {
  const startedAt = args.startedAt || now();
  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .insert({
      template_key: t.key,
      title: args.title?.trim() || t.title,
      description: t.description,
      client_name: args.clientName?.trim() || null,
      client_company: args.clientCompany?.trim() || null,
      client_phone: args.clientPhone?.replace(/\D/g, '') || null,
      client_email: args.clientEmail?.trim() || null,
      currency: (args.currency && (PROJECT_CURRENCIES as readonly string[]).includes(args.currency.toUpperCase()) ? args.currency.toUpperCase() : t.currency),
      status: 'active',
      started_at: startedAt,
      phases: initialPhases(t),
      durations: t.durations,
      rfq_context: t.rfq_context || {},
      created_by: args.actor.name,
    })
    .select('id')
    .single();
  if (error || !project) fail(error, 'Création du projet');
  const id = project.id as string;
  const plan = buildPlan(t, startedAt);
  const r1 = await supabaseAdmin.from('project_steps').insert(plan.steps.map((s) => ({ project_id: id, ...s })));
  if (r1.error) fail(r1.error, 'Étapes');
  const r2 = await supabaseAdmin.from('project_tasks').insert(plan.tasks.map((x) => ({ project_id: id, step_key: x.step_key, key: x.key, title: x.title, description: x.description, owner: x.owner, phase: x.phase, due_weeks: x.due_weeks, due_at: x.due_at, checklist: x.checklist, position: x.position })));
  if (r2.error) fail(r2.error, 'Tâches');
  const cur = (args.currency && (PROJECT_CURRENCIES as readonly string[]).includes(args.currency.toUpperCase()) ? args.currency.toUpperCase() : t.currency);
  const r3 = await supabaseAdmin.from('project_quote_lines').insert(t.quote_lines.map((l, i) => ({ project_id: id, lot: l.lot, label: l.label, unit: l.unit, quantity: l.quantity, unit_price: l.unit_price, price_currency: cur, cost_currency: cur, optional: l.optional, enabled: !l.optional, phase: l.phase, position: i })));
  if (r3.error) fail(r3.error, 'Lignes de devis');
  const r4 = await supabaseAdmin.from('project_final_reports').insert(t.phases.map((p) => ({ project_id: id, phase: p.id, checklist: t.final_report_checklist.map((label, i) => ({ id: `${p.id}-r${i + 1}`, label, done: false })) })));
  if (r4.error) fail(r4.error, 'Rapports');
  // Messages RFQ prêts à partir (EN + ZH), un par lot, composés avec le plan.
  const rows = rfqRowsFromTemplate(t, t.key.startsWith('ia-') ? 'ai' : 'template');
  if (rows.length) {
    const r5 = await supabaseAdmin.from('project_rfq_messages').insert(rows.map((r) => ({ project_id: id, ...r })));
    if (r5.error && !isMissing(r5.error.message)) fail(r5.error, 'Messages RFQ');
  }
  await logEvent(id, { type: 'project.created', actor: args.actor, detail });
  return id;
}
/** Lignes project_rfq_messages d'un modèle : matière du modèle par lot, sinon composée depuis les lignes de devis. */
export function rfqRowsFromTemplate(t: ProjectTemplate, origin: RfqOrigin) {
  const lots = [...new Set([...t.lots, ...(t.rfq || []).map((r) => r.lot)])];
  return lots.map((lot) => {
    const m = rfqLotFor(lot, t);
    const lines = t.quote_lines.filter((l) => l.lot === lot);
    const texts = buildRfqMessages(m, t.rfq_context || DEFAULT_RFQ_CONTEXT, { quantities_zh: t.rfq?.find((r) => r.lot === lot) ? undefined : quantitiesZhFromLines(lines) || undefined });
    return { lot, product_en: m.product_en, product_zh: m.product_zh, quantities_en: m.quantities_en, requirements_en: m.requirements_en, ...texts, origin };
  });
}

export async function updateProject(id: string, patch: Partial<{ title: string; description: string; client_name: string; client_company: string; client_phone: string; client_email: string; status: string }>, actor: Actor) {
  const clean: Record<string, unknown> = { updated_at: now() };
  for (const k of ['title', 'description', 'client_name', 'client_company', 'client_email'] as const) if (typeof patch[k] === 'string') clean[k] = patch[k]!.trim();
  if (typeof patch.client_phone === 'string') clean.client_phone = patch.client_phone.replace(/\D/g, '') || null;
  if (patch.status && ['draft', 'active', 'closed'].includes(patch.status)) clean.status = patch.status;
  const { error } = await supabaseAdmin.from('projects').update(clean).eq('id', id);
  if (error) fail(error, 'Mise à jour du projet');
  await logEvent(id, { type: 'project.updated', actor, detail: Object.keys(clean).filter((k) => k !== 'updated_at').join(', ') });
}

/** Lecture complète d'un projet (toutes les tables liées), pour l'admin et la projection publique. */
export async function loadProject(id: string) {
  const { data: project, error } = await supabaseAdmin.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) fail(error, 'Lecture du projet');
  if (!project) return null;
  const q = <T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => p.then((r) => (r.error ? fail(r.error, 'Lecture') : r.data || []));
  const [steps, tasks, updates, questions, documents, suppliers, exchanges, quoteLines, orders, finalReports, shares, events, rfq, contacts] = await Promise.all([
    q(supabaseAdmin.from('project_steps').select('*').eq('project_id', id).order('position')),
    q(supabaseAdmin.from('project_tasks').select('*').eq('project_id', id).order('position')),
    q(supabaseAdmin.from('project_updates').select('*').eq('project_id', id).order('published_at', { ascending: false })),
    q(supabaseAdmin.from('project_questions').select('*').eq('project_id', id).order('created_at', { ascending: false })),
    q(supabaseAdmin.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false })),
    q(supabaseAdmin.from('project_suppliers').select('*').eq('project_id', id).order('lot').order('alias')),
    q(supabaseAdmin.from('project_supplier_exchanges').select('*').eq('project_id', id).order('exchanged_at', { ascending: false })),
    q(supabaseAdmin.from('project_quote_lines').select('*').eq('project_id', id).order('position')),
    q(supabaseAdmin.from('project_orders').select('*').eq('project_id', id).order('created_at', { ascending: false })),
    q(supabaseAdmin.from('project_final_reports').select('*').eq('project_id', id).order('phase')),
    q(supabaseAdmin.from('project_shares').select('*').eq('project_id', id).order('created_at', { ascending: false })),
    q(supabaseAdmin.from('project_events').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(300)),
    // Table ajoutée par la migration du 30 sept. : tolérée absente le temps de la migration.
    supabaseAdmin.from('project_rfq_messages').select('*').eq('project_id', id).order('lot').then((r) => (r.error && !isMissing(r.error.message) ? fail(r.error, 'Lecture') : r.data || [])),
    // Historique complet des contacts usines (le journal d'audit ci-dessus est limité aux 300 derniers événements).
    q(supabaseAdmin.from('project_events').select('id, type, target_id, actor_name, detail, data, created_at').eq('project_id', id).in('type', ['email.sent', 'contact.manual']).order('created_at', { ascending: false })),
  ]);
  const taskIds = tasks.map((t: { id: string }) => t.id);
  const updateIds = updates.map((u: { id: string }) => u.id);
  const questionIds = questions.map((x: { id: string }) => x.id);
  const [taskComments, updateComments, questionReplies] = await Promise.all([
    taskIds.length ? q(supabaseAdmin.from('project_task_comments').select('*').in('task_id', taskIds).order('created_at')) : Promise.resolve([]),
    updateIds.length ? q(supabaseAdmin.from('project_update_comments').select('*').in('update_id', updateIds).order('created_at')) : Promise.resolve([]),
    questionIds.length ? q(supabaseAdmin.from('project_question_replies').select('*').in('question_id', questionIds).order('created_at')) : Promise.resolve([]),
  ]);
  return { project, steps, tasks, taskComments, updates, updateComments, questions, questionReplies, documents, suppliers, exchanges, quoteLines, orders, finalReports, shares, events, rfq, contacts };
}
export type ProjectBundle = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

// ---- Tâches ----
async function phasesOf(projectId: string): Promise<Phase[]> {
  const { data } = await supabaseAdmin.from('projects').select('phases').eq('id', projectId).maybeSingle();
  return ((data as { phases?: Phase[] } | null)?.phases || []) as Phase[];
}
async function taskOf(projectId: string, taskId: string) {
  const { data } = await supabaseAdmin.from('project_tasks').select('*').eq('id', taskId).eq('project_id', projectId).maybeSingle();
  if (!data) throw new ProjectError('Tâche introuvable', 404);
  return data as { id: string; title: string; owner: 'team' | 'client'; phase: string | null; status: 'todo' | 'done'; checklist: ChecklistItem[]; attachments: Attachment[] };
}
export async function setTaskDone(projectId: string, taskId: string, done: boolean, actor: Actor) {
  const t = await taskOf(projectId, taskId);
  const gate = canCompleteTask(t, actor.kind, await phasesOf(projectId));
  if (!gate.ok) throw new ProjectError(gate.reason, 403);
  const { error } = await supabaseAdmin.from('project_tasks').update({ status: done ? 'done' : 'todo', done_at: done ? now() : null, done_by: done ? actor.name : null, updated_at: now() }).eq('id', taskId);
  if (error) fail(error, 'Tâche');
  await logEvent(projectId, { type: done ? 'task.done' : 'task.reopened', actor, target_type: 'task', target_id: taskId, detail: t.title, notify: actor.kind === 'client' ? 'team' : 'client' });
}
export async function setTaskChecklist(projectId: string, taskId: string, itemId: string, done: boolean, actor: Actor) {
  const t = await taskOf(projectId, taskId);
  const gate = canCompleteTask(t, actor.kind, await phasesOf(projectId));
  if (!gate.ok && t.owner !== actor.kind) throw new ProjectError(gate.reason, 403);
  const { error } = await supabaseAdmin.from('project_tasks').update({ checklist: toggleChecklist(t.checklist, itemId, done), updated_at: now() }).eq('id', taskId);
  if (error) fail(error, 'Checklist');
  await logEvent(projectId, { type: 'task.checklist', actor, target_type: 'task', target_id: taskId, detail: `${t.title} · ${itemId} ${done ? 'coché' : 'décoché'}` });
}
export async function addTaskComment(projectId: string, taskId: string, text: string, attachments: Attachment[], actor: Actor) {
  const t = await taskOf(projectId, taskId);
  const body = text.trim();
  if (!body && !attachments.length) throw new ProjectError('Commentaire vide');
  const { error } = await supabaseAdmin.from('project_task_comments').insert({ task_id: taskId, author: actor.kind, author_name: actor.name, text: body, attachments });
  if (error) fail(error, 'Commentaire');
  await logEvent(projectId, { type: 'task.comment', actor, target_type: 'task', target_id: taskId, detail: `${t.title} : ${body.slice(0, 120)}`, notify: actor.kind === 'client' ? 'team' : 'client' });
}
export async function addTaskAttachments(projectId: string, taskId: string, attachments: Attachment[], actor: Actor) {
  const t = await taskOf(projectId, taskId);
  const { error } = await supabaseAdmin.from('project_tasks').update({ attachments: [...t.attachments, ...attachments], updated_at: now() }).eq('id', taskId);
  if (error) fail(error, 'Pièce jointe');
  await logEvent(projectId, { type: 'task.attachment', actor, target_type: 'task', target_id: taskId, detail: attachments.map((a) => a.name).join(', ') });
}
export async function updateTask(projectId: string, taskId: string, patch: { title?: string; description?: string; owner?: 'team' | 'client'; due_at?: string | null; phase?: string | null; checklist?: string[] }, actor: Actor) {
  const t = await taskOf(projectId, taskId);
  const clean: Record<string, unknown> = { updated_at: now() };
  if (typeof patch.title === 'string' && patch.title.trim()) clean.title = patch.title.trim();
  if (typeof patch.description === 'string') clean.description = patch.description.trim();
  if (patch.owner === 'team' || patch.owner === 'client') clean.owner = patch.owner;
  if (patch.due_at !== undefined) clean.due_at = patch.due_at;
  if (patch.phase !== undefined) clean.phase = patch.phase;
  if (Array.isArray(patch.checklist)) clean.checklist = patch.checklist.map((label, i) => ({ id: t.checklist[i]?.id || `${taskId.slice(0, 8)}-${i + 1}`, label: String(label).trim(), done: t.checklist.find((c) => c.label === label)?.done || false })).filter((c) => c.label);
  const { error } = await supabaseAdmin.from('project_tasks').update(clean).eq('id', taskId);
  if (error) fail(error, 'Tâche');
  await logEvent(projectId, { type: 'task.updated', actor, target_type: 'task', target_id: taskId, detail: t.title });
}
export async function addTask(projectId: string, input: { step_key: string; title: string; description?: string; owner: 'team' | 'client'; due_at?: string | null; phase?: string | null; checklist?: string[] }, actor: Actor) {
  const { count } = await supabaseAdmin.from('project_tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('step_key', input.step_key);
  const key = `custom-${randomUUID().slice(0, 8)}`;
  const { data, error } = await supabaseAdmin
    .from('project_tasks')
    .insert({ project_id: projectId, step_key: input.step_key, key, title: input.title.trim(), description: (input.description || '').trim(), owner: input.owner, due_at: input.due_at || null, phase: input.phase || null, checklist: (input.checklist || []).map((label, i) => ({ id: `${key}-${i + 1}`, label, done: false })), position: count || 0 })
    .select('id')
    .single();
  if (error || !data) fail(error, 'Nouvelle tâche');
  await logEvent(projectId, { type: 'task.created', actor, target_type: 'task', target_id: data.id, detail: input.title, notify: 'client' });
  return data.id as string;
}

// ---- Journal ----
export async function publishUpdate(projectId: string, input: { title: string; body: string; attachments: Attachment[] }, actor: Actor) {
  if (!input.title.trim()) throw new ProjectError('Titre requis');
  const { data, error } = await supabaseAdmin.from('project_updates').insert({ project_id: projectId, title: input.title.trim(), body: input.body.trim(), attachments: input.attachments, author_name: actor.name }).select('id').single();
  if (error || !data) fail(error, 'Mise à jour');
  await logEvent(projectId, { type: 'update.published', actor, target_type: 'update', target_id: data.id, detail: input.title.trim(), notify: 'client' });
  return data.id as string;
}
export async function addUpdateComment(projectId: string, updateId: string, text: string, actor: Actor) {
  const body = text.trim();
  if (!body) throw new ProjectError('Commentaire vide');
  const { data: u } = await supabaseAdmin.from('project_updates').select('id, title').eq('id', updateId).eq('project_id', projectId).maybeSingle();
  if (!u) throw new ProjectError('Mise à jour introuvable', 404);
  const { error } = await supabaseAdmin.from('project_update_comments').insert({ update_id: updateId, author: actor.kind, author_name: actor.name, text: body });
  if (error) fail(error, 'Commentaire');
  await logEvent(projectId, { type: 'update.comment', actor, target_type: 'update', target_id: updateId, detail: `${u.title} : ${body.slice(0, 120)}`, notify: actor.kind === 'client' ? 'team' : 'client' });
}

// ---- Questions ----
export async function askQuestion(projectId: string, input: { subject: string; detail: string; attachment: Attachment | null }, actor: Actor) {
  if (!input.subject.trim()) throw new ProjectError('Objet requis');
  const { data, error } = await supabaseAdmin.from('project_questions').insert({ project_id: projectId, subject: input.subject.trim(), detail: input.detail.trim(), attachment: input.attachment, asked_by: actor.name }).select('id').single();
  if (error || !data) fail(error, 'Question');
  await logEvent(projectId, { type: 'question.asked', actor, target_type: 'question', target_id: data.id, detail: input.subject.trim(), notify: 'team' });
  return data.id as string;
}
export async function replyQuestion(projectId: string, questionId: string, text: string, actor: Actor) {
  const body = text.trim();
  if (!body) throw new ProjectError('Réponse vide');
  const { data: qn } = await supabaseAdmin.from('project_questions').select('*').eq('id', questionId).eq('project_id', projectId).maybeSingle();
  if (!qn) throw new ProjectError('Question introuvable', 404);
  const { error } = await supabaseAdmin.from('project_question_replies').insert({ question_id: questionId, author: actor.kind, author_name: actor.name, text: body });
  if (error) fail(error, 'Réponse');
  // Question du client : répondue quand l'équipe répond. Question de l'équipe au client : répondue quand le client répond.
  const answeredBy = qn.direction === 'to_client' ? 'client' : 'team';
  if (actor.kind === answeredBy) await supabaseAdmin.from('project_questions').update({ status: 'answered', answered_at: now() }).eq('id', questionId);
  else await supabaseAdmin.from('project_questions').update({ status: 'open' }).eq('id', questionId);
  await logEvent(projectId, { type: 'question.replied', actor, target_type: 'question', target_id: questionId, detail: `${qn.subject} : ${body.slice(0, 120)}`, notify: actor.kind === 'team' ? 'client' : 'team' });
}

/**
 * Questions de l'équipe au client (souvent extraites d'un échange avec une
 * usine). Le lien vers l'usine et l'échange reste interne ; une question qui
 * citerait l'usine (nom, sigle, site, ville) est refusée.
 */
export async function askClientQuestions(projectId: string, input: { questions: { subject: string; detail?: string }[]; lot?: string | null; supplier_id?: string | null; exchange_id?: string | null }, actor: Actor) {
  const qs = input.questions.map((q) => ({ subject: String(q.subject || '').replace(/\s+/g, ' ').trim().slice(0, 200), detail: String(q.detail || '').trim().slice(0, 3000) })).filter((q) => q.subject);
  if (!qs.length) throw new ProjectError('Aucune question');
  if (qs.length > 20) throw new ProjectError('20 questions au plus à la fois');
  let supplier: { id: string; real_name: string | null; website: string | null; city: string | null } | null = null;
  if (input.supplier_id) {
    const { data } = await supabaseAdmin.from('project_suppliers').select('id, real_name, website, city').eq('id', input.supplier_id).eq('project_id', projectId).maybeSingle();
    if (!data) throw new ProjectError('Usine introuvable', 404);
    supplier = data;
  }
  if (supplier?.real_name) {
    const tokens = identifyingTokens({ real_name: supplier.real_name, website: supplier.website, city: supplier.city });
    for (const q of qs) {
      const found = leaks(`${q.subject} ${q.detail}`, tokens);
      if (found.length) throw new ProjectError(`La question « ${q.subject.slice(0, 60)} » cite l’usine (${found.join(', ')}) : reformulez-la sans la nommer`);
    }
  }
  const rows = qs.map((q) => ({ project_id: projectId, subject: q.subject, detail: q.detail, attachment: null, asked_by: actor.name, direction: 'to_client', lot: input.lot?.trim() || null, supplier_id: supplier?.id || null, exchange_id: input.exchange_id || null }));
  const { data, error } = await supabaseAdmin.from('project_questions').insert(rows).select('id');
  if (error || !data) fail(error, 'Questions');
  for (const [i, r] of data.entries()) await logEvent(projectId, { type: 'question.to_client', actor, target_type: 'question', target_id: r.id, detail: qs[i].subject, notify: 'client' });
  return data.map((r) => r.id as string);
}

// ---- Documents (bucket privé) ----
const safeName = (n: string) => n.replace(/[^\w.\-() àâäéèêëîïôöùûüç]/gi, '_').slice(0, 120) || 'fichier';
export async function storeDocument(projectId: string, file: { name: string; mime: string; size: number; buffer: Buffer }, meta: { category: DocumentCategory; internal: boolean }, actor: Actor): Promise<{ id: string; attachment: Attachment }> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
  const path = `${projectId}/${randomUUID()}.${ext}`;
  const up = await supabaseAdmin.storage.from(PROJECT_BUCKET).upload(path, file.buffer, { contentType: file.mime, cacheControl: '3600', upsert: false });
  if (up.error) throw new ProjectError(/not found|bucket/i.test(up.error.message) ? 'Bucket « project-files » absent : lancer recreate-buckets.ts --apply' : `Envoi impossible : ${up.error.message}`, 500);
  const { data, error } = await supabaseAdmin.from('project_documents').insert({ project_id: projectId, category: meta.category, name: safeName(file.name), storage_path: path, mime: file.mime, size: file.size, uploaded_by: actor.name, internal: meta.internal }).select('id').single();
  if (error || !data) fail(error, 'Document');
  const kind: Attachment['kind'] = file.mime.startsWith('image/') ? 'image' : 'document';
  return { id: data.id as string, attachment: { name: safeName(file.name), url: `/api/projects/${projectId}/documents/${data.id}`, size: file.size, kind, by: actor.name, at: now() } };
}
/**
 * Lien signé (15 min) d'un document. Par défaut, ouverture dans le navigateur
 * (PDF, images, texte affichés dans l'onglet) ; download = fichier enregistré
 * sous son nom d'origine.
 */
export async function signedDocumentUrl(projectId: string, docId: string, opts: { allowInternal: boolean; download?: boolean }): Promise<{ url: string; name: string } | null> {
  const { data } = await supabaseAdmin.from('project_documents').select('storage_path, name, internal').eq('id', docId).eq('project_id', projectId).maybeSingle();
  if (!data || (data.internal && !opts.allowInternal)) return null;
  const s = await supabaseAdmin.storage.from(PROJECT_BUCKET).createSignedUrl(data.storage_path, SIGNED_URL_SECONDS, opts.download ? { download: data.name } : undefined);
  if (s.error || !s.data?.signedUrl) return null;
  return { url: s.data.signedUrl, name: data.name };
}
// ---- Vidéo de couverture (affichée en tête de l'espace client) ----
export async function setCoverVideo(projectId: string, file: { name: string; mime: string; size: number; buffer: Buffer }, actor: Actor) {
  const { data: p } = await supabaseAdmin.from('projects').select('cover_video_path').eq('id', projectId).maybeSingle();
  if (!p) throw new ProjectError('Projet introuvable', 404);
  const path = `${projectId}/cover-${randomUUID()}.${file.mime === 'video/webm' ? 'webm' : 'mp4'}`;
  const up = await supabaseAdmin.storage.from(PROJECT_BUCKET).upload(path, file.buffer, { contentType: file.mime, cacheControl: '86400', upsert: false });
  if (up.error) throw new ProjectError(/not found|bucket/i.test(up.error.message) ? 'Bucket « project-files » absent : lancer recreate-buckets.ts --apply' : /mime|type/i.test(up.error.message) ? 'Le bucket « project-files » n’accepte pas encore les vidéos : relancer recreate-buckets.ts --apply' : /size|large|exceed/i.test(up.error.message) ? 'Vidéo refusée par le stockage (taille) : relancer recreate-buckets.ts --apply ou compresser la vidéo' : `Envoi impossible : ${up.error.message}`, 500);
  const { error } = await supabaseAdmin.from('projects').update({ cover_video_path: path, cover_video_mime: file.mime, cover_video_size: file.size, cover_video_updated_at: now(), updated_at: now() }).eq('id', projectId);
  if (error) {
    await supabaseAdmin.storage.from(PROJECT_BUCKET).remove([path]);
    fail(error, 'Vidéo de couverture');
  }
  if (p.cover_video_path) await supabaseAdmin.storage.from(PROJECT_BUCKET).remove([p.cover_video_path]);
  await logEvent(projectId, { type: 'cover.updated', actor, detail: `${safeName(file.name)} · ${Math.round(file.size / 104857.6) / 10} Mo` });
}
export async function removeCoverVideo(projectId: string, actor: Actor) {
  const { data: p } = await supabaseAdmin.from('projects').select('cover_video_path').eq('id', projectId).maybeSingle();
  if (!p?.cover_video_path) return;
  const { error } = await supabaseAdmin.from('projects').update({ cover_video_path: null, cover_video_mime: null, cover_video_size: null, cover_video_updated_at: now(), updated_at: now() }).eq('id', projectId);
  if (error) fail(error, 'Vidéo de couverture');
  await supabaseAdmin.storage.from(PROJECT_BUCKET).remove([p.cover_video_path]);
  await logEvent(projectId, { type: 'cover.removed', actor });
}
/** Lien signé (1 h, lecture en ligne) : assez long pour les requêtes de plage pendant la lecture. */
export async function signedCoverUrl(projectId: string): Promise<string | null> {
  const { data: p } = await supabaseAdmin.from('projects').select('cover_video_path').eq('id', projectId).maybeSingle();
  if (!p?.cover_video_path) return null;
  const s = await supabaseAdmin.storage.from(PROJECT_BUCKET).createSignedUrl(p.cover_video_path, 3600);
  return s.error || !s.data?.signedUrl ? null : s.data.signedUrl;
}
export async function deleteDocument(projectId: string, docId: string, actor: Actor) {
  const { data } = await supabaseAdmin.from('project_documents').select('storage_path, name').eq('id', docId).eq('project_id', projectId).maybeSingle();
  if (!data) throw new ProjectError('Document introuvable', 404);
  await supabaseAdmin.storage.from(PROJECT_BUCKET).remove([data.storage_path]);
  const { error } = await supabaseAdmin.from('project_documents').delete().eq('id', docId);
  if (error) fail(error, 'Suppression');
  await logEvent(projectId, { type: 'document.deleted', actor, target_type: 'document', target_id: docId, detail: data.name });
}

// ---- Fournisseurs et échanges (équipe seulement) ----
export interface SupplierInput {
  id?: string;
  lot: string;
  real_name?: string;
  contact?: string;
  contact_name?: string;
  email?: string;
  wechat?: string;
  whatsapp?: string;
  phone?: string;
  website?: string;
  preferred_channel?: ContactChannel | '' | null;
  contact_source?: string;
  country?: string;
  city?: string;
  indicative_price?: string;
  internal_note?: string;
  status?: SupplierStatus;
  scores?: Scores | null;
  /** Note globale /25 saisie à la main (ignorée si la grille est remplie). */
  score?: number | null;
  description?: string;
  product_specs?: ProductSpec[];
  certifications?: string[];
  years_experience?: number | null;
  capacity?: string;
  lead_time?: string;
  moq?: string;
  sample_status?: SampleStatus | '' | null;
  /** Points à surveiller (équipe seulement), un par entrée. */
  watch_points?: string[];
}
const SUPPLIER_STATUSES: SupplierStatus[] = ['candidate', 'shortlisted', 'selected', 'rejected'];
const CONTACT_CHANNELS: ContactChannel[] = ['email', 'wechat', 'whatsapp', 'alibaba', 'website', 'phone'];
const SAMPLE_STATUSES: SampleStatus[] = ['none', 'requested', 'received', 'validated'];
function cleanScores(v: Scores | null | undefined): Scores {
  const out: Scores = {};
  for (const k of ['certifications', 'tropical', 'installation', 'price', 'transparency'] as const) {
    const n = Number(v?.[k]);
    if (v && v[k] != null && Number.isFinite(n)) out[k] = Math.min(5, Math.max(0, Math.round(n)));
  }
  return out;
}
function supplierRow(input: SupplierInput) {
  const t = (v: string | undefined | null) => (typeof v === 'string' ? v.trim() || null : undefined);
  const scores = input.scores === undefined ? undefined : cleanScores(input.scores);
  const total = scores ? scoreTotal(scores) : undefined;
  const row: Record<string, unknown> = {
    lot: input.lot.trim(),
    real_name: t(input.real_name), contact: t(input.contact), contact_name: t(input.contact_name), email: t(input.email), wechat: t(input.wechat), whatsapp: t(input.whatsapp), phone: t(input.phone), website: t(input.website), contact_source: t(input.contact_source),
    country: t(input.country), city: t(input.city), indicative_price: t(input.indicative_price), internal_note: t(input.internal_note),
    description: t(input.description), capacity: t(input.capacity), lead_time: t(input.lead_time), moq: t(input.moq),
    updated_at: now(),
  };
  if (input.preferred_channel !== undefined) row.preferred_channel = CONTACT_CHANNELS.includes(input.preferred_channel as ContactChannel) ? input.preferred_channel : null;
  if (input.sample_status !== undefined) row.sample_status = SAMPLE_STATUSES.includes(input.sample_status as SampleStatus) ? input.sample_status : null;
  if (input.status !== undefined && SUPPLIER_STATUSES.includes(input.status)) row.status = input.status;
  if (scores) {
    row.scores = scores;
    row.score = total ?? (input.score == null ? null : Math.min(25, Math.max(0, Number(input.score))));
  } else if (input.score !== undefined) row.score = input.score == null || !Number.isFinite(Number(input.score)) ? null : Math.min(25, Math.max(0, Number(input.score)));
  if (input.product_specs !== undefined) row.product_specs = (input.product_specs || []).map((x) => ({ label: String(x.label || '').trim().slice(0, 80), value: String(x.value || '').trim().slice(0, 300) })).filter((x) => x.label && x.value).slice(0, 30);
  if (input.watch_points !== undefined) row.watch_points = (input.watch_points || []).map((x) => String(x).replace(/\s+/g, ' ').trim().slice(0, 400)).filter(Boolean).slice(0, 12);
  if (input.certifications !== undefined) row.certifications = (input.certifications || []).map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 20);
  if (input.years_experience !== undefined) row.years_experience = input.years_experience == null || !Number.isFinite(Number(input.years_experience)) ? null : Math.max(0, Math.round(Number(input.years_experience)));
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
  return row;
}
export async function upsertSupplier(projectId: string, input: SupplierInput, actor: Actor) {
  const lot = input.lot.trim();
  if (!lot) throw new ProjectError('Lot requis');
  const row = supplierRow(input);
  if (input.id) {
    const { data: before } = await supabaseAdmin.from('project_suppliers').select('status, alias').eq('id', input.id).eq('project_id', projectId).maybeSingle();
    if (!before) throw new ProjectError('Fournisseur introuvable', 404);
    if (row.status && row.status !== before.status) row.selected_at = row.status === 'selected' ? now() : null;
    const { error } = await supabaseAdmin.from('project_suppliers').update(row).eq('id', input.id).eq('project_id', projectId);
    if (error) fail(error, 'Fournisseur');
    await logEvent(projectId, { type: 'supplier.updated', actor, target_type: 'supplier', target_id: input.id, detail: `${lot} · ${before.alias}` });
    if (row.status && row.status !== before.status) await logStatus(projectId, input.id, lot, String(before.alias), row.status as SupplierStatus, actor);
    return input.id;
  }
  const { count } = await supabaseAdmin.from('project_suppliers').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('lot', lot);
  const alias = supplierAlias(count || 0);
  const { data, error } = await supabaseAdmin.from('project_suppliers').insert({ project_id: projectId, alias, ...row, selected_at: row.status === 'selected' ? now() : null }).select('id').single();
  if (error || !data) fail(error, 'Fournisseur');
  await logEvent(projectId, { type: 'supplier.added', actor, target_type: 'supplier', target_id: data.id, detail: `${lot} · ${alias}` });
  if (row.status && row.status !== 'candidate') await logStatus(projectId, data.id, lot, alias, row.status as SupplierStatus, actor);
  return data.id as string;
}
/** Statut de sélection : retenue (le client est prévenu, sous alias), présélectionnée, écartée, candidate. */
export async function setSupplierStatus(projectId: string, id: string, status: SupplierStatus, actor: Actor) {
  if (!SUPPLIER_STATUSES.includes(status)) throw new ProjectError('Statut inconnu');
  const { data: s } = await supabaseAdmin.from('project_suppliers').select('lot, alias, status').eq('id', id).eq('project_id', projectId).maybeSingle();
  if (!s) throw new ProjectError('Fournisseur introuvable', 404);
  if (s.status === status) return;
  const { error } = await supabaseAdmin.from('project_suppliers').update({ status, selected_at: status === 'selected' ? now() : null, updated_at: now() }).eq('id', id);
  if (error) fail(error, 'Fournisseur');
  await logStatus(projectId, id, s.lot, s.alias, status, actor);
}
async function logStatus(projectId: string, id: string, lot: string, alias: string, status: SupplierStatus, actor: Actor) {
  const type = status === 'selected' ? 'supplier.selected' : status === 'shortlisted' ? 'supplier.shortlisted' : status === 'rejected' ? 'supplier.rejected' : 'supplier.candidate';
  await logEvent(projectId, { type, actor, target_type: 'supplier', target_id: id, detail: `${lot} · ${alias}`, notify: status === 'selected' ? 'client' : null });
}
/**
 * Import du résultat d'un skill de sourcing (validateSourcingImport) : une usine
 * déjà présente (même lot, même nom) n'est complétée que sur ses champs vides
 * et garde le statut décidé par l'équipe ; les nouvelles reçoivent un alias.
 */
export async function importSuppliers(projectId: string, items: ImportedSupplier[], actor: Actor) {
  const { data: rows, error } = await supabaseAdmin.from('project_suppliers').select('*').eq('project_id', projectId);
  if (error) fail(error, 'Usines');
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  let added = 0;
  let completed = 0;
  for (const it of items) {
    const found = (rows || []).find((r) => r.lot === it.lot && norm(String(r.real_name || '')) === norm(it.real_name)) as Record<string, unknown> | undefined;
    // Champs renseignés seulement (null = inconnu, jamais un effacement).
    const fields = Object.fromEntries(Object.entries(it).filter(([k, v]) => k !== 'element' && v != null)) as unknown as SupplierInput;
    if (!found) {
      await upsertSupplier(projectId, fields, actor);
      added += 1;
      continue;
    }
    const empty = (k: string) => found[k] == null || found[k] === '' || (Array.isArray(found[k]) && !(found[k] as unknown[]).length) || (k === 'scores' && !Object.keys((found[k] as object) || {}).length);
    const patch: SupplierInput = { id: String(found.id), lot: it.lot };
    for (const [k, v] of Object.entries(fields) as [keyof SupplierInput, unknown][]) {
      if (k === 'lot' || k === 'status' || v == null || (Array.isArray(v) && !v.length)) continue;
      if (empty(k)) (patch as unknown as Record<string, unknown>)[k] = v;
    }
    if (found.status === 'candidate' && it.status === 'shortlisted') patch.status = 'shortlisted';
    if (Object.keys(patch).length > 2) {
      await upsertSupplier(projectId, patch, actor);
      completed += 1;
    }
  }
  await logEvent(projectId, { type: 'supplier.imported', actor, detail: `${added} ajoutée(s), ${completed} complétée(s)` });
  return { added, completed };
}
// ---- Photos des produits reçues de l'usine (montrées au client dans la fiche anonymisée) ----
export const MAX_SUPPLIER_PHOTOS = 12;
/** Photo prête pour le client : orientation corrigée, 2000 px max, JPEG, métadonnées (GPS, appareil) retirées. Sans sharp : fichier tel quel. */
export async function prepareProductPhoto(file: { name: string; mime: string; size: number; buffer: Buffer }) {
  try {
    const sharp = (await import('sharp')).default;
    const buffer = await sharp(file.buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return { name: `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, mime: 'image/jpeg', size: buffer.length, buffer };
  } catch {
    return file;
  }
}
export async function addSupplierPhotos(projectId: string, supplierId: string, files: { name: string; mime: string; size: number; buffer: Buffer }[], actor: Actor) {
  const { data: s } = await supabaseAdmin.from('project_suppliers').select('lot, alias, product_photos').eq('id', supplierId).eq('project_id', projectId).maybeSingle();
  if (!s) throw new ProjectError('Usine introuvable', 404);
  const current = (s.product_photos || []) as ProductPhoto[];
  if (current.length + files.length > MAX_SUPPLIER_PHOTOS) throw new ProjectError(`${MAX_SUPPLIER_PHOTOS} photos au plus par usine (${current.length} déjà)`);
  const added: ProductPhoto[] = [];
  for (const f of files) {
    if (!f.mime.startsWith('image/')) throw new ProjectError(`« ${f.name} » n’est pas une image`);
    // Document interne : jamais listé côté client, servi seulement via la fiche usine.
    const doc = await storeDocument(projectId, await prepareProductPhoto(f), { category: 'technical', internal: true }, actor);
    added.push({ doc_id: doc.id, caption: '' });
  }
  const { error } = await supabaseAdmin.from('project_suppliers').update({ product_photos: [...current, ...added], updated_at: now() }).eq('id', supplierId);
  if (error) fail(error, 'Photos');
  await logEvent(projectId, { type: 'supplier.photos', actor, target_type: 'supplier', target_id: supplierId, detail: `${s.lot} · ${s.alias} : ${added.length} photo(s)` });
  return added;
}
/** Ordre et légendes ; une photo retirée de la liste est supprimée du stockage. */
export async function setSupplierPhotos(projectId: string, supplierId: string, photos: ProductPhoto[], actor: Actor) {
  const { data: s } = await supabaseAdmin.from('project_suppliers').select('product_photos').eq('id', supplierId).eq('project_id', projectId).maybeSingle();
  if (!s) throw new ProjectError('Usine introuvable', 404);
  const current = (s.product_photos || []) as ProductPhoto[];
  const known = new Set(current.map((x) => x.doc_id));
  const next = photos.filter((x) => known.has(x.doc_id)).map((x) => ({ doc_id: x.doc_id, caption: String(x.caption || '').replace(/\s+/g, ' ').trim().slice(0, 160) }));
  const { error } = await supabaseAdmin.from('project_suppliers').update({ product_photos: next, updated_at: now() }).eq('id', supplierId);
  if (error) fail(error, 'Photos');
  const kept = new Set(next.map((x) => x.doc_id));
  for (const gone of current.filter((x) => !kept.has(x.doc_id))) await deleteDocument(projectId, gone.doc_id, actor).catch(() => undefined);
}
/** Lien signé d'une photo pour le client : seulement si elle figure dans la fiche d'une usine du projet. */
export async function signedSupplierPhotoUrl(projectId: string, docId: string): Promise<string | null> {
  const { data: sups } = await supabaseAdmin.from('project_suppliers').select('product_photos').eq('project_id', projectId);
  const listed = (sups || []).some((x) => ((x.product_photos || []) as ProductPhoto[]).some((p) => p.doc_id === docId));
  if (!listed) return null;
  const { data } = await supabaseAdmin.from('project_documents').select('storage_path').eq('id', docId).eq('project_id', projectId).maybeSingle();
  if (!data) return null;
  const r = await supabaseAdmin.storage.from(PROJECT_BUCKET).createSignedUrl(data.storage_path, SIGNED_URL_SECONDS);
  return r.error || !r.data?.signedUrl ? null : r.data.signedUrl;
}
// ---- E-mails aux usines depuis la plateforme (Resend) ----
/** Envoie un e-mail à une usine et le note dans les échanges (canal e-mail). */
export async function sendSupplierEmail(projectId: string, input: { supplier_id: string; to: string; cc?: string; subject: string; body: string; nonce?: string; lot?: string }, actor: Actor) {
  const { data: s } = await supabaseAdmin.from('project_suppliers').select('id, lot, alias, real_name').eq('id', input.supplier_id).eq('project_id', projectId).maybeSingle();
  if (!s) throw new ProjectError('Usine introuvable', 404);
  const to = parseRecipients(input.to);
  if (!to.length) throw new ProjectError('Adresse du destinataire invalide');
  const r = await sendEmail({
    to,
    cc: parseRecipients(input.cc || ''),
    subject: input.subject,
    text: input.body,
    tags: { projet: projectId.slice(0, 8), lot: s.lot, usine: s.alias },
    idempotencyKey: input.nonce ? `${projectId}:${s.id}:${input.nonce}` : undefined,
  });
  if (!r.ok) throw new ProjectError(r.error, 502);
  const from = emailSender()?.address || '';
  await addExchange(projectId, { supplier_id: s.id, channel: 'email', summary: `E-mail envoyé depuis ${from} à ${to.join(', ')}${input.cc ? ` (cc ${parseRecipients(input.cc).join(', ')})` : ''}\nObjet : ${input.subject.trim()}\n\n${input.body.trim().slice(0, 1500)}${input.body.trim().length > 1500 ? '…' : ''}`, attachments: [], next_action: 'Relancer si pas de réponse', next_action_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), direction: 'out' }, actor);
  await logEvent(projectId, { type: 'email.sent', actor, target_type: 'supplier', target_id: s.id, detail: `${s.lot} · ${s.alias} : ${input.subject.trim().slice(0, 100)}`, data: { resend_id: r.id, to, channel: 'email', subject: input.subject.trim().slice(0, 200), rfq_lot: input.lot || null } });
  return { id: r.id, to };
}
/**
 * Contact fait hors plateforme (WhatsApp, WeChat, messagerie personnelle,
 * Alibaba…) : noté dans les échanges et l'historique des contacts.
 */
export async function markContacted(projectId: string, input: { supplier_id: string; channel: string; lot?: string; note?: string }, actor: Actor) {
  const channels: Record<string, ExchangeChannel> = { email: 'email', whatsapp: 'whatsapp', wechat: 'wechat', phone: 'phone', alibaba: 'other', other: 'other' };
  const ch = channels[input.channel] || 'other';
  const { data: s } = await supabaseAdmin.from('project_suppliers').select('id, lot, alias').eq('id', input.supplier_id).eq('project_id', projectId).maybeSingle();
  if (!s) throw new ProjectError('Usine introuvable', 404);
  const label = { email: 'e-mail (messagerie personnelle)', whatsapp: 'WhatsApp', wechat: 'WeChat', phone: 'téléphone', alibaba: 'Alibaba', other: 'autre canal' }[input.channel] || 'autre canal';
  const what = input.lot ? `Demande de prix (lot ${input.lot})` : 'Message';
  await addExchange(projectId, { supplier_id: s.id, channel: ch, summary: `${what} envoyée par ${label}, hors plateforme.${input.note?.trim() ? `\n${input.note.trim().slice(0, 1000)}` : ''}`, attachments: [], next_action: 'Relancer si pas de réponse', next_action_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), direction: 'out' }, actor);
  await logEvent(projectId, { type: 'contact.manual', actor, target_type: 'supplier', target_id: s.id, detail: `${s.lot} · ${s.alias} : ${label}`, data: { channel: input.channel, rfq_lot: input.lot || null } });
}
/** E-mail d'essai (vérifier la configuration Resend). */
export async function sendTestEmail(projectId: string, to: string, actor: Actor) {
  const sender = emailSender();
  const r = await sendEmail({ to: parseRecipients(to), subject: `Test d’envoi — ${COUNTRY.senderName}`, text: `Ceci est un e-mail d’essai envoyé depuis la plateforme ${COUNTRY.senderName} (onglet Projets), expéditeur ${sender?.address || '—'}.\n\nSi vous le recevez, l’envoi aux usines fonctionne. Les réponses arrivent dans la boîte ${sender?.address || 'de l’expéditeur'}.`, tags: { type: 'test' } });
  if (!r.ok) throw new ProjectError(r.error, 502);
  await logEvent(projectId, { type: 'email.test', actor, detail: parseRecipients(to).join(', ') });
  return { id: r.id };
}
export async function deleteSupplier(projectId: string, id: string, actor: Actor) {
  const { error } = await supabaseAdmin.from('project_suppliers').delete().eq('id', id).eq('project_id', projectId);
  if (error) fail(error, 'Fournisseur');
  await logEvent(projectId, { type: 'supplier.deleted', actor, target_type: 'supplier', target_id: id });
}
export async function addExchange(projectId: string, input: { supplier_id: string | null; channel: ExchangeChannel; exchanged_at?: string; summary: string; attachments: Attachment[]; next_action?: string; next_action_at?: string | null; analysis?: Record<string, unknown> | null; direction?: 'out' | 'in' | 'note' }, actor: Actor) {
  if (!input.summary.trim() && !input.attachments.length) throw new ProjectError('Résumé ou capture requis');
  const row: Record<string, unknown> = { project_id: projectId, supplier_id: input.supplier_id, channel: input.channel, exchanged_at: input.exchanged_at || now(), summary: input.summary.trim(), attachments: input.attachments, next_action: input.next_action?.trim() || null, next_action_at: input.next_action_at || null, author_name: actor.name, ...(input.analysis ? { analysis: input.analysis } : {}), ...(input.direction && ['out', 'in', 'note'].includes(input.direction) ? { direction: input.direction } : {}) };
  let { data, error } = await supabaseAdmin.from('project_supplier_exchanges').insert(row).select('id').single();
  // Colonne « direction » pas encore migrée (fenêtre avant approbation au Gabon) : enregistrer sans le sens.
  if (error && 'direction' in row && /direction/.test(error.message) && isMissing(error.message)) {
    delete row.direction;
    ({ data, error } = await supabaseAdmin.from('project_supplier_exchanges').insert(row).select('id').single());
  }
  if (error || !data) fail(error, 'Échange');
  await logEvent(projectId, { type: 'exchange.added', actor, target_type: 'exchange', target_id: data.id, detail: input.summary.trim().slice(0, 120) });
  return data.id as string;
}
/** Rattache un échange à une usine (échanges enregistrés sans usine) et en fixe le sens. */
export async function assignExchange(projectId: string, id: string, supplierId: string, direction: 'out' | 'in' | 'note' | null, actor: Actor) {
  const { data: sup } = await supabaseAdmin.from('project_suppliers').select('id, lot, alias').eq('id', supplierId).eq('project_id', projectId).maybeSingle();
  if (!sup) throw new ProjectError('Usine introuvable', 404);
  let { error } = await supabaseAdmin.from('project_supplier_exchanges').update({ supplier_id: sup.id, ...(direction ? { direction } : {}) }).eq('id', id).eq('project_id', projectId);
  // Colonne « direction » pas encore migrée : rattacher quand même.
  if (error && direction && /direction/.test(error.message) && isMissing(error.message)) ({ error } = await supabaseAdmin.from('project_supplier_exchanges').update({ supplier_id: sup.id }).eq('id', id).eq('project_id', projectId));
  if (error) fail(error, 'Échange');
  await logEvent(projectId, { type: 'exchange.assigned', actor, target_type: 'supplier', target_id: sup.id, detail: `${sup.lot} · ${sup.alias}` });
}
export async function deleteExchange(projectId: string, id: string, actor: Actor) {
  const { error } = await supabaseAdmin.from('project_supplier_exchanges').delete().eq('id', id).eq('project_id', projectId);
  if (error) fail(error, 'Échange');
  await logEvent(projectId, { type: 'exchange.deleted', actor, target_type: 'exchange', target_id: id });
}

// ---- Messages RFQ (équipe seulement) ----
export async function saveRfqMessage(projectId: string, lot: string, patch: Partial<{ product_en: string; product_zh: string; quantities_en: string; requirements_en: string[]; email_subject_en: string; email_body_en: string; short_en: string; short_zh: string }>, actor: Actor) {
  const l = lot.trim();
  if (!l) throw new ProjectError('Lot requis');
  const row: Record<string, unknown> = { origin: 'manual', updated_at: now() };
  for (const k of ['product_en', 'product_zh', 'quantities_en', 'email_subject_en', 'email_body_en', 'short_en', 'short_zh'] as const) if (typeof patch[k] === 'string') row[k] = patch[k]!.trim().slice(0, k === 'email_body_en' ? 6000 : 600);
  if (Array.isArray(patch.requirements_en)) row.requirements_en = patch.requirements_en.map((x) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 10);
  const { error } = await supabaseAdmin.from('project_rfq_messages').upsert({ project_id: projectId, lot: l, ...row }, { onConflict: 'project_id,lot' });
  if (error) fail(error, 'Message RFQ');
  await logEvent(projectId, { type: 'rfq.saved', actor, target_type: 'rfq', target_id: l, detail: l });
}
/** Recompose les messages d'un lot (ou de tous) depuis le modèle du projet ; les modifications manuelles sont remplacées. */
export async function regenerateRfqMessages(projectId: string, lot: string | null, actor: Actor) {
  const { data: p } = await supabaseAdmin.from('projects').select('template_key, rfq_context').eq('id', projectId).maybeSingle();
  if (!p) throw new ProjectError('Projet introuvable', 404);
  const t = templateByKey(String(p.template_key || ''));
  const saved = (p.rfq_context && typeof p.rfq_context === 'object' ? p.rfq_context : {}) as Partial<RfqContext>;
  const rfq_context: RfqContext | undefined = saved.project_en ? { project_en: String(saved.project_en), project_zh: String(saved.project_zh || saved.project_en), requirements_en: Array.isArray(saved.requirements_en) ? saved.requirements_en.map(String) : [] } : t?.rfq_context;
  const { data: lines } = await supabaseAdmin.from('project_quote_lines').select('lot, label, unit, quantity').eq('project_id', projectId).order('position');
  const { data: existing } = await supabaseAdmin.from('project_rfq_messages').select('lot, product_en, product_zh, quantities_en, requirements_en').eq('project_id', projectId);
  const { data: sups } = await supabaseAdmin.from('project_suppliers').select('lot').eq('project_id', projectId);
  const quote_lines = (lines || []).map((l) => ({ lot: String(l.lot), label: String(l.label), unit: String(l.unit), quantity: Number(l.quantity), unit_price: null, optional: false, phase: null }));
  // Matière : celle du modèle, sinon celle déjà enregistrée (produit, quantités, exigences), sinon les lignes de devis.
  const rfq = [...(t?.rfq || [])];
  for (const e of existing || []) if (!rfq.some((r) => r.lot === e.lot)) rfq.push({ lot: e.lot, product_en: e.product_en, product_zh: e.product_zh, quantities_en: e.quantities_en, requirements_en: e.requirements_en || [] });
  const lots = [...new Set([...(t?.lots || []), ...rfq.map((r) => r.lot), ...quote_lines.map((l) => l.lot), ...(sups || []).map((x) => String(x.lot))])].filter((l) => !lot || l === lot);
  const base: ProjectTemplate = { ...(t || { key: 'x', title: '', description: '', currency: '', phases: [], durations: { transit: {}, production: [0, 0], technician_visa: [0, 0], padel_slab_cure: 0 }, steps: [], lots: [], business_trip: { title: '', days: [] }, final_report_checklist: [] }), quote_lines, rfq, lots, rfq_context };
  const rows = rfqRowsFromTemplate(base, 'template').filter((r) => lots.includes(r.lot));
  if (!rows.length) throw new ProjectError('Aucun lot à composer');
  const { error } = await supabaseAdmin.from('project_rfq_messages').upsert(rows.map((r) => ({ project_id: projectId, ...r, updated_at: now() })), { onConflict: 'project_id,lot' });
  if (error) fail(error, 'Messages RFQ');
  await logEvent(projectId, { type: 'rfq.regenerated', actor, detail: lot || `${rows.length} lot(s)` });
  return rows.length;
}
export async function setRfqSender(projectId: string, sender: Partial<RfqSender>, actor: Actor) {
  const clean: Partial<RfqSender> = {};
  for (const k of ['name', 'company', 'whatsapp', 'wechat', 'email'] as const) if (typeof sender[k] === 'string' && sender[k]!.trim()) clean[k] = sender[k]!.trim().slice(0, 120);
  const { error } = await supabaseAdmin.from('projects').update({ rfq_sender: clean, updated_at: now() }).eq('id', projectId);
  if (error) fail(error, 'Signature RFQ');
  await logEvent(projectId, { type: 'rfq.sender', actor, detail: clean.name || '' });
}

// ---- Devises et taux ----
async function fxOf(projectId: string): Promise<{ base: string; rates: Rates }> {
  const { data: p } = await supabaseAdmin.from('projects').select('currency, rates').eq('id', projectId).maybeSingle();
  if (!p) throw new ProjectError('Projet introuvable', 404);
  const base = String(p.currency || 'USD').toUpperCase();
  return { base, rates: cleanRates(p.rates, base) };
}
/** Table de taux « 1 devise = X devise principale » (remplace la table). */
export async function setRates(projectId: string, raw: unknown, actor: Actor) {
  const { base } = await fxOf(projectId);
  const rates = cleanRates(raw, base);
  const { error } = await supabaseAdmin.from('projects').update({ rates, updated_at: now() }).eq('id', projectId);
  if (error) fail(error, 'Taux');
  await logEvent(projectId, { type: 'fx.rates', actor, detail: Object.entries(rates).map(([c, v]) => `1 ${c} = ${v} ${base}`).join(' · ') || 'aucun taux' });
}
/**
 * Devise principale : les montants saisis gardent leur devise ; les taux sont
 * recalculés vers la nouvelle base (l'ancienne base entre dans la table).
 * Refusé si une ligne est déjà validée ou commandée (instantanés figés dans l'ancienne devise).
 */
export async function setProjectCurrency(projectId: string, currency: string, actor: Actor) {
  const cur = currency.toUpperCase();
  if (!(PROJECT_CURRENCIES as readonly string[]).includes(cur)) throw new ProjectError('Devise inconnue');
  const { base, rates } = await fxOf(projectId);
  if (cur === base) return;
  const { count } = await supabaseAdmin.from('project_quote_lines').select('id', { count: 'exact', head: true }).eq('project_id', projectId).neq('status', 'draft');
  if (count) throw new ProjectError('Des lignes sont validées ou commandées : la devise principale ne peut plus changer', 409);
  const { data: lines } = await supabaseAdmin.from('project_quote_lines').select('price_currency, cost_currency').eq('project_id', projectId);
  const used = (lines || []).flatMap((l) => [l.price_currency, l.cost_currency]).filter((c): c is string => !!c);
  const next = rebaseRates(rates, base, cur, used);
  const { error } = await supabaseAdmin.from('projects').update({ currency: cur, rates: next, updated_at: now() }).eq('id', projectId);
  if (error) fail(error, 'Devise');
  await logEvent(projectId, { type: 'fx.currency', actor, detail: `${base} → ${cur}`, notify: 'client' });
}

// ---- Devis ----
type LineRow = { id: string; lot: string; label: string; quantity: number; client_quantity: number | null; unit_price: number | null; price_currency: string | null; optional: boolean; enabled: boolean; status: 'draft' | 'validated' | 'ordered'; phase: string | null };
async function lineOf(projectId: string, lineId: string): Promise<LineRow> {
  const { data } = await supabaseAdmin.from('project_quote_lines').select('*').eq('id', lineId).eq('project_id', projectId).maybeSingle();
  if (!data) throw new ProjectError('Ligne introuvable', 404);
  return data as LineRow;
}
const CURRENCY_RE = /^[A-Z]{3}$/;
const currencyOr = (v: unknown, def: string) => (typeof v === 'string' && CURRENCY_RE.test(v.toUpperCase()) ? v.toUpperCase() : def);
export async function upsertQuoteLine(projectId: string, input: { id?: string; lot: string; label: string; unit?: string; quantity?: number; unit_price?: number | null; price_currency?: string | null; unit_cost?: number | null; cost_currency?: string | null; optional?: boolean; enabled?: boolean; phase?: string | null; supplier_id?: string | null }, actor: Actor) {
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const { base } = await fxOf(projectId);
  if (input.id) {
    const l = await lineOf(projectId, input.id);
    if (l.status !== 'draft') throw new ProjectError('Ligne validée : annuler la validation avant de la modifier', 409);
    const patch: Record<string, unknown> = { updated_at: now() };
    if (input.lot?.trim()) patch.lot = input.lot.trim();
    if (input.label?.trim()) patch.label = input.label.trim();
    if (input.unit?.trim()) patch.unit = input.unit.trim();
    if (input.quantity !== undefined) patch.quantity = Math.max(0, num(input.quantity) ?? 0);
    if (input.unit_price !== undefined) patch.unit_price = num(input.unit_price);
    if (input.unit_cost !== undefined) patch.unit_cost = num(input.unit_cost);
    if (input.price_currency !== undefined || input.unit_price !== undefined) patch.price_currency = currencyOr(input.price_currency, base);
    if (input.cost_currency !== undefined || input.unit_cost !== undefined) patch.cost_currency = currencyOr(input.cost_currency, base);
    if (typeof input.optional === 'boolean') patch.optional = input.optional;
    if (typeof input.enabled === 'boolean') patch.enabled = input.enabled;
    if (input.phase !== undefined) patch.phase = input.phase;
    if (input.supplier_id !== undefined) patch.supplier_id = input.supplier_id;
    const { error } = await supabaseAdmin.from('project_quote_lines').update(patch).eq('id', input.id);
    if (error) fail(error, 'Ligne');
    await logEvent(projectId, { type: 'quote.line_updated', actor, target_type: 'quote_line', target_id: input.id, detail: l.label });
    return input.id;
  }
  if (!input.lot?.trim() || !input.label?.trim()) throw new ProjectError('Lot et désignation requis');
  const { count } = await supabaseAdmin.from('project_quote_lines').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
  const { data, error } = await supabaseAdmin
    .from('project_quote_lines')
    .insert({ project_id: projectId, lot: input.lot.trim(), label: input.label.trim(), unit: input.unit?.trim() || 'pièce', quantity: Math.max(0, num(input.quantity) ?? 1), unit_price: num(input.unit_price), price_currency: currencyOr(input.price_currency, base), unit_cost: num(input.unit_cost), cost_currency: currencyOr(input.cost_currency, base), optional: !!input.optional, enabled: input.enabled ?? !input.optional, phase: input.phase || null, supplier_id: input.supplier_id || null, position: count || 0 })
    .select('id')
    .single();
  if (error || !data) fail(error, 'Ligne');
  await logEvent(projectId, { type: 'quote.line_added', actor, target_type: 'quote_line', target_id: data.id, detail: input.label.trim(), notify: 'client' });
  return data.id as string;
}
export async function deleteQuoteLine(projectId: string, lineId: string, actor: Actor) {
  const l = await lineOf(projectId, lineId);
  if (l.status !== 'draft') throw new ProjectError('Ligne validée ou commandée : suppression impossible', 409);
  const { error } = await supabaseAdmin.from('project_quote_lines').delete().eq('id', lineId);
  if (error) fail(error, 'Ligne');
  await logEvent(projectId, { type: 'quote.line_deleted', actor, target_type: 'quote_line', target_id: lineId, detail: l.label });
}
/** Client : quantité et activation d'une option (lignes en brouillon seulement). */
export async function setClientLineChoice(projectId: string, lineId: string, patch: { client_quantity?: number | null; enabled?: boolean }, actor: Actor) {
  const l = await lineOf(projectId, lineId);
  if (l.status !== 'draft') throw new ProjectError('Ligne validée : annuler la validation avant de la modifier', 409);
  const clean: Record<string, unknown> = { updated_at: now() };
  if (patch.client_quantity !== undefined) clean.client_quantity = patch.client_quantity === null ? null : Math.max(0, Number(patch.client_quantity) || 0);
  if (typeof patch.enabled === 'boolean' && l.optional) clean.enabled = patch.enabled;
  const { error } = await supabaseAdmin.from('project_quote_lines').update(clean).eq('id', lineId);
  if (error) fail(error, 'Ligne');
  await logEvent(projectId, { type: 'quote.client_choice', actor, target_type: 'quote_line', target_id: lineId, detail: `${l.label} : ${JSON.stringify(patch)}` });
}
export async function validateLine(projectId: string, lineId: string, actor: Actor) {
  const raw = await lineOf(projectId, lineId);
  const { base, rates } = await fxOf(projectId);
  // Prix converti dans la devise principale au taux du jour ; le taux est figé dans l'instantané.
  const rate = rateOf(raw.price_currency, base, rates);
  const l = { ...raw, unit_price: toBase(raw.unit_price, raw.price_currency, base, rates) };
  if (raw.unit_price != null && rate == null) throw new ProjectError(`Taux manquant pour ${raw.price_currency} : renseignez-le dans « Devises et taux »`, 409);
  const gate = canValidateLine(l, await phasesOf(projectId));
  if (!gate.ok) throw new ProjectError(gate.reason, 409);
  const snapshot = { quantity: effectiveQuantity(l), unit_price: l.unit_price, total: lineTotal(l), currency: base, entered: { amount: raw.unit_price, currency: raw.price_currency || base, rate } };
  const { error } = await supabaseAdmin.from('project_quote_lines').update({ status: 'validated', validated_at: now(), validated_by: actor.name, validated_snapshot: snapshot, updated_at: now() }).eq('id', lineId);
  if (error) fail(error, 'Validation');
  await logEvent(projectId, { type: 'quote.line_validated', actor, target_type: 'quote_line', target_id: lineId, detail: `${l.label} · ${snapshot.quantity} × ${snapshot.unit_price} = ${snapshot.total} ${base}`, data: snapshot, notify: actor.kind === 'client' ? 'team' : 'client' });
}
export async function unvalidateLine(projectId: string, lineId: string, actor: Actor) {
  const l = await lineOf(projectId, lineId);
  if (!canUnvalidateLine(l)) throw new ProjectError('Ligne déjà passée en commande', 409);
  const { error } = await supabaseAdmin.from('project_quote_lines').update({ status: 'draft', validated_at: null, validated_by: null, validated_snapshot: null, updated_at: now() }).eq('id', lineId);
  if (error) fail(error, 'Validation');
  await logEvent(projectId, { type: 'quote.line_unvalidated', actor, target_type: 'quote_line', target_id: lineId, detail: l.label, notify: actor.kind === 'client' ? 'team' : 'client' });
}

// ---- Commandes ----
export async function createOrderFromValidated(projectId: string, lineIds: string[], actor: Actor) {
  const { data: lines } = await supabaseAdmin.from('project_quote_lines').select('*').eq('project_id', projectId).in('id', lineIds).eq('status', 'validated');
  const rows = (lines || []) as (LineRow & { validated_snapshot: { total: number | null } | null })[];
  if (!rows.length) throw new ProjectError('Aucune ligne validée sélectionnée');
  const total = rows.reduce((s, l) => s + (l.validated_snapshot?.total ?? lineTotal(l) ?? 0), 0);
  const { count } = await supabaseAdmin.from('project_orders').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
  const reference = `CMD-${String((count || 0) + 1).padStart(3, '0')}`;
  const { data, error } = await supabaseAdmin.from('project_orders').insert({ project_id: projectId, reference, status: 'validated', line_ids: rows.map((l) => l.id), total: Math.round(total * 100) / 100, history: [{ status: 'validated', at: now(), by: actor.name }] }).select('id').single();
  if (error || !data) fail(error, 'Commande');
  await supabaseAdmin.from('project_quote_lines').update({ status: 'ordered', order_id: data.id, updated_at: now() }).in('id', rows.map((l) => l.id));
  await logEvent(projectId, { type: 'order.created', actor, target_type: 'order', target_id: data.id, detail: `${reference} · ${rows.length} ligne(s)`, notify: 'client' });
  return data.id as string;
}
export async function advanceOrder(projectId: string, orderId: string, to: OrderStatus, actor: Actor, tracking?: string) {
  const { data } = await supabaseAdmin.from('project_orders').select('*').eq('id', orderId).eq('project_id', projectId).maybeSingle();
  if (!data) throw new ProjectError('Commande introuvable', 404);
  const o = data as { reference: string; status: OrderStatus; history: unknown[] };
  if (!canAdvanceOrder(o.status, to)) throw new ProjectError(`Passage ${o.status} → ${to} impossible`, 409);
  const patch: Record<string, unknown> = { status: to, history: [...(o.history || []), { status: to, at: now(), by: actor.name }], updated_at: now() };
  if (tracking !== undefined) patch.tracking = tracking.trim() || null;
  const { error } = await supabaseAdmin.from('project_orders').update(patch).eq('id', orderId);
  if (error) fail(error, 'Commande');
  // Chaque changement de statut alimente aussi le journal.
  await supabaseAdmin.from('project_updates').insert({ project_id: projectId, title: `Commande ${o.reference} : ${orderStatusLabelSafe(to)}`, body: tracking?.trim() ? `Suivi : ${tracking.trim()}` : '', attachments: [], author_name: actor.name });
  await logEvent(projectId, { type: 'order.status', actor, target_type: 'order', target_id: orderId, detail: `${o.reference} → ${to}`, notify: 'client' });
}
function orderStatusLabelSafe(s: string): string {
  const m: Record<string, string> = { validated: 'validée par le client', issued: 'commande émise', deposit_secured: 'acompte 30 % sécurisé', production: 'en production', inspection: 'inspection avant expédition', shipped: 'expédiée', in_transit: 'en transit', delivered: 'livrée sur site' };
  return m[s] || s;
}

// ---- Phases, rapports, voyage ----
export async function receivePhase(projectId: string, phaseId: string, received: boolean, actor: Actor) {
  const phases = await phasesOf(projectId);
  if (!phases.some((p) => p.id === phaseId)) throw new ProjectError('Phase introuvable', 404);
  const next = phases.map((p) => (p.id === phaseId ? { ...p, received_at: received ? now() : null } : p));
  const { error } = await supabaseAdmin.from('projects').update({ phases: next, updated_at: now() }).eq('id', projectId);
  if (error) fail(error, 'Phase');
  await logEvent(projectId, { type: received ? 'phase.received' : 'phase.reopened', actor, target_type: 'phase', target_id: phaseId, notify: 'client' });
}
export async function setReport(projectId: string, phase: string, patch: { checklist?: ChecklistItem[]; delivered?: boolean; file_id?: string | null }, actor: Actor) {
  const clean: Record<string, unknown> = {};
  if (Array.isArray(patch.checklist)) clean.checklist = patch.checklist;
  if (typeof patch.delivered === 'boolean') clean.delivered_at = patch.delivered ? now() : null;
  if (patch.file_id !== undefined) clean.file_id = patch.file_id;
  const { error } = await supabaseAdmin.from('project_final_reports').upsert({ project_id: projectId, phase, ...clean }, { onConflict: 'project_id,phase' });
  if (error) fail(error, 'Rapport');
  if (patch.delivered) await logEvent(projectId, { type: 'report.delivered', actor, target_type: 'report', target_id: phase, notify: 'client' });
}
export async function businessTrip(projectId: string, what: 'interested' | 'quote', actor: Actor) {
  const col = what === 'interested' ? 'business_trip_interested_at' : 'business_trip_quote_requested_at';
  const { error } = await supabaseAdmin.from('projects').update({ [col]: now(), updated_at: now() }).eq('id', projectId);
  if (error) fail(error, 'Voyage');
  await logEvent(projectId, { type: what === 'interested' ? 'trip.interested' : 'trip.quote_requested', actor, notify: 'team' });
}

// ---- Liens client ----
export async function createShare(projectId: string, input: { person_name: string; role_label?: string; expires_at?: string | null }, actor: Actor) {
  if (!input.person_name.trim()) throw new ProjectError('Nom de la personne requis');
  const token = randomBytes(32).toString('base64url');
  const { data, error } = await supabaseAdmin.from('project_shares').insert({ project_id: projectId, token, person_name: input.person_name.trim(), role_label: input.role_label?.trim() || null, expires_at: input.expires_at || null }).select('id, token').single();
  if (error || !data) fail(error, 'Lien');
  await logEvent(projectId, { type: 'share.created', actor, target_type: 'share', target_id: data.id, detail: input.person_name.trim() });
  return { id: data.id as string, token: data.token as string, path: `/projet/${data.token}` };
}
export async function revokeShare(projectId: string, shareId: string, actor: Actor) {
  const { error } = await supabaseAdmin.from('project_shares').update({ revoked_at: now() }).eq('id', shareId).eq('project_id', projectId);
  if (error) fail(error, 'Lien');
  await logEvent(projectId, { type: 'share.revoked', actor, target_type: 'share', target_id: shareId });
}
/** Jeton → projet et personne, ou null (inconnu, révoqué, expiré). Compte la vue. */
export async function resolveShare(token: string): Promise<{ projectId: string; share: { id: string; person_name: string; role_label: string | null } } | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const { data } = await supabaseAdmin.from('project_shares').select('id, project_id, person_name, role_label, expires_at, revoked_at, views').eq('token', token).maybeSingle();
  if (!data || data.revoked_at || (data.expires_at && new Date(data.expires_at) < new Date())) return null;
  await supabaseAdmin.from('project_shares').update({ views: (data.views || 0) + 1, last_seen_at: now() }).eq('id', data.id);
  return { projectId: data.project_id, share: { id: data.id, person_name: data.person_name, role_label: data.role_label } };
}

export async function markTeamSeen(projectId: string) {
  await supabaseAdmin.from('project_events').update({ seen_by_team_at: now() }).eq('project_id', projectId).eq('notify', 'team').is('seen_by_team_at', null);
}
