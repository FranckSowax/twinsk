// Onglet « Projets » — côté serveur (supabaseAdmin). Création depuis un
// modèle, lecture complète d'un projet, actions (tâches, journal, questions,
// documents, fournisseurs et échanges usines, devis, commandes, rapports,
// phases, liens client), audit dans project_events. Les fichiers vont dans
// le bucket PRIVÉ project-files et sont servis par liens signés.

import { randomBytes, randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { COUNTRY } from '@/config/countries';
import { buildPlan, canAdvanceOrder, canCompleteTask, canUnvalidateLine, canValidateLine, effectiveQuantity, initialPhases, lineTotal, supplierAlias, toggleChecklist } from './logic';
import { templateByKey } from './templates/dom-tom';
import type { Attachment, ChecklistItem, DocumentCategory, ExchangeChannel, OrderStatus, Phase, ProjectTemplate } from './types';

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
      currency: t.currency,
      status: 'active',
      started_at: startedAt,
      phases: initialPhases(t),
      durations: t.durations,
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
  const r3 = await supabaseAdmin.from('project_quote_lines').insert(t.quote_lines.map((l, i) => ({ project_id: id, lot: l.lot, label: l.label, unit: l.unit, quantity: l.quantity, unit_price: l.unit_price, optional: l.optional, enabled: !l.optional, phase: l.phase, position: i })));
  if (r3.error) fail(r3.error, 'Lignes de devis');
  const r4 = await supabaseAdmin.from('project_final_reports').insert(t.phases.map((p) => ({ project_id: id, phase: p.id, checklist: t.final_report_checklist.map((label, i) => ({ id: `${p.id}-r${i + 1}`, label, done: false })) })));
  if (r4.error) fail(r4.error, 'Rapports');
  await logEvent(id, { type: 'project.created', actor: args.actor, detail });
  return id;
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
  const [steps, tasks, updates, questions, documents, suppliers, exchanges, quoteLines, orders, finalReports, shares, events] = await Promise.all([
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
  ]);
  const taskIds = tasks.map((t: { id: string }) => t.id);
  const updateIds = updates.map((u: { id: string }) => u.id);
  const questionIds = questions.map((x: { id: string }) => x.id);
  const [taskComments, updateComments, questionReplies] = await Promise.all([
    taskIds.length ? q(supabaseAdmin.from('project_task_comments').select('*').in('task_id', taskIds).order('created_at')) : Promise.resolve([]),
    updateIds.length ? q(supabaseAdmin.from('project_update_comments').select('*').in('update_id', updateIds).order('created_at')) : Promise.resolve([]),
    questionIds.length ? q(supabaseAdmin.from('project_question_replies').select('*').in('question_id', questionIds).order('created_at')) : Promise.resolve([]),
  ]);
  return { project, steps, tasks, taskComments, updates, updateComments, questions, questionReplies, documents, suppliers, exchanges, quoteLines, orders, finalReports, shares, events };
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
  const { data: qn } = await supabaseAdmin.from('project_questions').select('id, subject').eq('id', questionId).eq('project_id', projectId).maybeSingle();
  if (!qn) throw new ProjectError('Question introuvable', 404);
  const { error } = await supabaseAdmin.from('project_question_replies').insert({ question_id: questionId, author: actor.kind, author_name: actor.name, text: body });
  if (error) fail(error, 'Réponse');
  if (actor.kind === 'team') await supabaseAdmin.from('project_questions').update({ status: 'answered', answered_at: now() }).eq('id', questionId);
  else await supabaseAdmin.from('project_questions').update({ status: 'open' }).eq('id', questionId);
  await logEvent(projectId, { type: 'question.replied', actor, target_type: 'question', target_id: questionId, detail: `${qn.subject} : ${body.slice(0, 120)}`, notify: actor.kind === 'team' ? 'client' : 'team' });
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
export async function signedDocumentUrl(projectId: string, docId: string, opts: { allowInternal: boolean }): Promise<{ url: string; name: string } | null> {
  const { data } = await supabaseAdmin.from('project_documents').select('storage_path, name, internal').eq('id', docId).eq('project_id', projectId).maybeSingle();
  if (!data || (data.internal && !opts.allowInternal)) return null;
  const s = await supabaseAdmin.storage.from(PROJECT_BUCKET).createSignedUrl(data.storage_path, SIGNED_URL_SECONDS, { download: data.name });
  if (s.error || !s.data?.signedUrl) return null;
  return { url: s.data.signedUrl, name: data.name };
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
export async function upsertSupplier(projectId: string, input: { id?: string; lot: string; real_name?: string; contact?: string; country?: string; score?: number | null; internal_note?: string }, actor: Actor) {
  const lot = input.lot.trim();
  if (!lot) throw new ProjectError('Lot requis');
  if (input.id) {
    const { error } = await supabaseAdmin.from('project_suppliers').update({ lot, real_name: input.real_name?.trim() || null, contact: input.contact?.trim() || null, country: input.country?.trim() || null, score: input.score ?? null, internal_note: input.internal_note?.trim() || null }).eq('id', input.id).eq('project_id', projectId);
    if (error) fail(error, 'Fournisseur');
    return input.id;
  }
  const { count } = await supabaseAdmin.from('project_suppliers').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('lot', lot);
  const { data, error } = await supabaseAdmin.from('project_suppliers').insert({ project_id: projectId, lot, alias: supplierAlias(count || 0), real_name: input.real_name?.trim() || null, contact: input.contact?.trim() || null, country: input.country?.trim() || null, score: input.score ?? null, internal_note: input.internal_note?.trim() || null }).select('id').single();
  if (error || !data) fail(error, 'Fournisseur');
  await logEvent(projectId, { type: 'supplier.added', actor, target_type: 'supplier', target_id: data.id, detail: `${lot} · ${supplierAlias(count || 0)}` });
  return data.id as string;
}
export async function deleteSupplier(projectId: string, id: string, actor: Actor) {
  const { error } = await supabaseAdmin.from('project_suppliers').delete().eq('id', id).eq('project_id', projectId);
  if (error) fail(error, 'Fournisseur');
  await logEvent(projectId, { type: 'supplier.deleted', actor, target_type: 'supplier', target_id: id });
}
export async function addExchange(projectId: string, input: { supplier_id: string | null; channel: ExchangeChannel; exchanged_at?: string; summary: string; attachments: Attachment[]; next_action?: string; next_action_at?: string | null }, actor: Actor) {
  if (!input.summary.trim() && !input.attachments.length) throw new ProjectError('Résumé ou capture requis');
  const { data, error } = await supabaseAdmin.from('project_supplier_exchanges').insert({ project_id: projectId, supplier_id: input.supplier_id, channel: input.channel, exchanged_at: input.exchanged_at || now(), summary: input.summary.trim(), attachments: input.attachments, next_action: input.next_action?.trim() || null, next_action_at: input.next_action_at || null, author_name: actor.name }).select('id').single();
  if (error || !data) fail(error, 'Échange');
  await logEvent(projectId, { type: 'exchange.added', actor, target_type: 'exchange', target_id: data.id, detail: input.summary.trim().slice(0, 120) });
  return data.id as string;
}
export async function deleteExchange(projectId: string, id: string, actor: Actor) {
  const { error } = await supabaseAdmin.from('project_supplier_exchanges').delete().eq('id', id).eq('project_id', projectId);
  if (error) fail(error, 'Échange');
  await logEvent(projectId, { type: 'exchange.deleted', actor, target_type: 'exchange', target_id: id });
}

// ---- Devis ----
type LineRow = { id: string; lot: string; label: string; quantity: number; client_quantity: number | null; unit_price: number | null; optional: boolean; enabled: boolean; status: 'draft' | 'validated' | 'ordered'; phase: string | null };
async function lineOf(projectId: string, lineId: string): Promise<LineRow> {
  const { data } = await supabaseAdmin.from('project_quote_lines').select('*').eq('id', lineId).eq('project_id', projectId).maybeSingle();
  if (!data) throw new ProjectError('Ligne introuvable', 404);
  return data as LineRow;
}
export async function upsertQuoteLine(projectId: string, input: { id?: string; lot: string; label: string; unit?: string; quantity?: number; unit_price?: number | null; unit_cost?: number | null; optional?: boolean; enabled?: boolean; phase?: string | null; supplier_id?: string | null }, actor: Actor) {
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
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
    .insert({ project_id: projectId, lot: input.lot.trim(), label: input.label.trim(), unit: input.unit?.trim() || 'pièce', quantity: Math.max(0, num(input.quantity) ?? 1), unit_price: num(input.unit_price), unit_cost: num(input.unit_cost), optional: !!input.optional, enabled: input.enabled ?? !input.optional, phase: input.phase || null, supplier_id: input.supplier_id || null, position: count || 0 })
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
  const l = await lineOf(projectId, lineId);
  const gate = canValidateLine(l, await phasesOf(projectId));
  if (!gate.ok) throw new ProjectError(gate.reason, 409);
  const snapshot = { quantity: effectiveQuantity(l), unit_price: l.unit_price, total: lineTotal(l) };
  const { error } = await supabaseAdmin.from('project_quote_lines').update({ status: 'validated', validated_at: now(), validated_by: actor.name, validated_snapshot: snapshot, updated_at: now() }).eq('id', lineId);
  if (error) fail(error, 'Validation');
  await logEvent(projectId, { type: 'quote.line_validated', actor, target_type: 'quote_line', target_id: lineId, detail: `${l.label} · ${snapshot.quantity} × ${snapshot.unit_price} = ${snapshot.total}`, data: snapshot, notify: actor.kind === 'client' ? 'team' : 'client' });
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
