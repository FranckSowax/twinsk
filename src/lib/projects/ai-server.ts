// Assistants IA de l'onglet « Projets » — côté serveur : appels au modèle,
// lecture des captures dans le bucket privé, collecte des faits pour le
// brouillon du journal, journalisation du coût (project_events ai.used).

import { supabaseAdmin } from '@/lib/supabase/server';
import { COUNTRY } from '@/config/countries';
import { chatCompletion, llmCostFcfa, parseJsonLoose, type LlmPart } from '@/lib/llm';
import { contactSystemPrompt, EXCHANGE_SYSTEM_PROMPT, exchangeAnalysisPrompt, validateExchangeAnalysis, type ExchangeAnalysis, FLASH_MODEL, PLAN_MODEL, planSystemPrompt, UPDATE_SYSTEM_PROMPT, updateFactsPrompt, validateContactFind, validateExchangeSummary, validateGeneratedTemplate, validateUpdateDraft, type ContactFind, type ExchangeSummary, type UpdateFacts } from './ai';
import { logEvent, PROJECT_BUCKET, ProjectError, type Actor } from './data';
import { orderStatusLabel, progress } from './logic';
import type { ProjectTemplate } from './types';

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costFcfa: number;
}

async function ask(args: { system: string; parts: LlmPart[]; model: string; maxTokens: number; projectId: string | null; actor: Actor; usage: string; jsonMode?: boolean }): Promise<{ json: unknown; usage: AiUsage }> {
  const r = await chatCompletion({ provider: 'openrouter', model: args.model, system: args.system, messages: [{ role: 'user', content: args.parts }], jsonMode: args.jsonMode ?? true, maxTokens: args.maxTokens, timeoutMs: 120_000, reasoning: 'low' });
  if (!r.ok) throw new ProjectError(`IA indisponible : ${r.error}`, 502);
  const json = parseJsonLoose(r.text);
  if (!json || typeof json !== 'object') throw new ProjectError('Réponse du modèle illisible', 502);
  const usage = { model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costFcfa: llmCostFcfa(r) };
  if (args.projectId) await logEvent(args.projectId, { type: 'ai.used', actor: args.actor, detail: `${args.usage} · ${usage.model} · ${usage.costFcfa} FCFA`, data: usage as unknown as Record<string, unknown> });
  return { json, usage };
}

/** 1. Plan de projet proposé depuis un brief (rien n'est créé : l'équipe relit puis crée). */
export async function generatePlanFromBrief(brief: string, currency: string, actor: Actor): Promise<{ template: ProjectTemplate; usage: AiUsage }> {
  const text = brief.trim();
  if (text.length < 40) throw new ProjectError('Brief trop court : décrivez le projet, les sites, les équipements et les contraintes.');
  const { json, usage } = await ask({ system: planSystemPrompt(currency), parts: [{ type: 'text', text: `Brief du client :\n${text.slice(0, 12_000)}` }], model: PLAN_MODEL, maxTokens: 8000, projectId: null, actor, usage: 'plan depuis brief' });
  const template = validateGeneratedTemplate(json, { currency, title: 'Projet' });
  if (!template) throw new ProjectError('Le modèle n’a pas produit de plan exploitable ; reformulez le brief.', 502);
  return { template, usage };
}

/** Capture du bucket privé → data URL (le modèle ne peut pas lire nos liens signés à coup sûr). */
async function imageDataUrl(projectId: string, docId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('project_documents').select('storage_path, mime').eq('id', docId).eq('project_id', projectId).maybeSingle();
  if (!data || !String(data.mime || '').startsWith('image/')) return null;
  const f = await supabaseAdmin.storage.from(PROJECT_BUCKET).download(data.storage_path);
  if (f.error || !f.data) return null;
  const buf = Buffer.from(await f.data.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) return null;
  return `data:${data.mime};base64,${buf.toString('base64')}`;
}

/** 2. Résumé d'un échange avec une usine à partir de captures (ids de documents) et de notes. */
export async function summarizeExchange(projectId: string, docIds: string[], notes: string, actor: Actor): Promise<{ result: ExchangeSummary; usage: AiUsage }> {
  const parts: LlmPart[] = [];
  for (const id of docIds.slice(0, 6)) {
    const url = await imageDataUrl(projectId, id);
    if (url) parts.push({ type: 'image', url });
  }
  if (!parts.length && !notes.trim()) throw new ProjectError('Joignez au moins une capture d’écran (image) ou des notes.');
  parts.push({ type: 'text', text: `${parts.length ? `${parts.length} capture(s) d’écran ci-dessus. ` : ''}${notes.trim() ? `Notes de l’équipe : ${notes.trim().slice(0, 3000)}` : 'Aucune note.'}\nDate du jour : ${new Date().toLocaleDateString('fr-FR', { timeZone: COUNTRY.timezone })}.` });
  const { json, usage } = await ask({ system: EXCHANGE_SYSTEM_PROMPT, parts, model: FLASH_MODEL, maxTokens: 1500, projectId, actor, usage: 'résumé échange usine' });
  const result = validateExchangeSummary(json);
  if (!result) throw new ProjectError('Résumé illisible ; réessayez ou complétez à la main.', 502);
  return { result, usage };
}

/** Faits des dernières 24 h (ou depuis la dernière mise à jour) pour le brouillon du journal. */
export async function collectUpdateFacts(projectId: string): Promise<UpdateFacts> {
  const { data: p } = await supabaseAdmin.from('projects').select('title').eq('id', projectId).maybeSingle();
  if (!p) throw new ProjectError('Projet introuvable', 404);
  const { data: last } = await supabaseAdmin.from('project_updates').select('published_at').eq('project_id', projectId).order('published_at', { ascending: false }).limit(1).maybeSingle();
  const sinceDate = new Date(Math.min(Date.now() - 24 * 3_600_000, last?.published_at ? new Date(last.published_at).getTime() : Date.now()));
  const since = sinceDate.toISOString();
  const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const [{ data: tasks }, { data: orders }, { data: questions }, { data: docs }, { data: exchanges }] = await Promise.all([
    supabaseAdmin.from('project_tasks').select('title, status, done_at, due_at, step_key').eq('project_id', projectId),
    supabaseAdmin.from('project_orders').select('reference, status, updated_at').eq('project_id', projectId).gte('updated_at', since),
    supabaseAdmin.from('project_questions').select('subject, status, answered_at, created_at').eq('project_id', projectId).or(`answered_at.gte.${since},status.eq.open`),
    supabaseAdmin.from('project_documents').select('name, internal, created_at').eq('project_id', projectId).eq('internal', false).gte('created_at', since),
    supabaseAdmin.from('project_supplier_exchanges').select('summary, exchanged_at').eq('project_id', projectId).gte('exchanged_at', since),
  ]);
  const t = (tasks || []) as { title: string; status: string; done_at: string | null; due_at: string | null; step_key: string }[];
  return {
    projectTitle: p.title,
    since: sinceDate.toLocaleDateString('fr-FR', { timeZone: COUNTRY.timezone }),
    tasksDone: t.filter((x) => x.status === 'done' && x.done_at && x.done_at >= since).map((x) => x.title),
    tasksDue: t.filter((x) => x.status !== 'done' && x.due_at && x.due_at <= in7).map((x) => `${x.title} (${new Date(x.due_at!).toLocaleDateString('fr-FR')})`),
    orders: ((orders || []) as { reference: string; status: string }[]).map((o) => `${o.reference} : ${orderStatusLabel(o.status)}`),
    questionsAnswered: ((questions || []) as { subject: string; status: string }[]).filter((q) => q.status === 'answered').map((q) => q.subject),
    questionsOpen: ((questions || []) as { subject: string; status: string }[]).filter((q) => q.status === 'open').map((q) => q.subject),
    documents: ((docs || []) as { name: string }[]).map((d) => d.name),
    exchanges: ((exchanges || []) as { summary: string }[]).map((e) => e.summary.slice(0, 300)),
    progressPct: Math.round(progress(t.map((x) => ({ step_key: x.step_key, status: x.status as 'todo' | 'done' }))).global * 100),
  };
}

/** 3. Brouillon de la mise à jour du jour (rien n'est publié : l'équipe relit). */
export async function draftDailyUpdate(projectId: string, actor: Actor): Promise<{ draft: { title: string; body: string }; facts: UpdateFacts; usage: AiUsage }> {
  const facts = await collectUpdateFacts(projectId);
  const { json, usage } = await ask({ system: UPDATE_SYSTEM_PROMPT, parts: [{ type: 'text', text: updateFactsPrompt(facts) }], model: FLASH_MODEL, maxTokens: 1200, projectId, actor, usage: 'brouillon journal' });
  const draft = validateUpdateDraft(json);
  if (!draft) throw new ProjectError('Brouillon illisible ; réessayez.', 502);
  return { draft, facts, usage };
}

/**
 * 4. Contacts d'une usine (e-mail, WeChat, WhatsApp) cherchés sur le web par le
 * modèle : suffixe OpenRouter « :online » (recherche web injectée dans le
 * contexte, facturée en plus des jetons). Rien n'est enregistré : l'équipe
 * vérifie puis colle dans la fiche. Le nom de l'usine ne quitte pas l'équipe.
 */
export const CONTACT_MODEL = process.env.PROJECT_CONTACT_MODEL || `${FLASH_MODEL}:online`;
export async function findSupplierContacts(projectId: string, s: { name: string; website?: string; city?: string; product?: string }, actor: Actor): Promise<{ result: ContactFind; usage: AiUsage }> {
  if (s.name.trim().length < 3) throw new ProjectError('Indiquez le nom de l’usine.');
  const text = [`Usine : ${s.name.trim().slice(0, 120)}`, s.website ? `Site : ${s.website.trim().slice(0, 200)}` : '', s.city ? `Ville : ${s.city.trim().slice(0, 80)}` : '', s.product ? `Produit : ${s.product.trim().slice(0, 200)}` : '', 'Trouve la page contact officielle et les identifiants WeChat / WhatsApp publiés.'].filter(Boolean).join('\n');
  // Pas de mode JSON strict : certains modèles avec recherche web le refusent ; parseJsonLoose suffit.
  const { json, usage } = await ask({ system: contactSystemPrompt(), parts: [{ type: 'text', text }], model: CONTACT_MODEL, maxTokens: 1200, projectId, actor, usage: 'recherche contacts usine', jsonMode: false });
  const result = validateContactFind(json);
  if (!result) throw new ProjectError('Aucun contact trouvé pour cette usine ; cherchez sur son site ou Alibaba.', 404);
  return { result, usage };
}

/**
 * 5. Analyse d'un échange avec une usine : résumé, explication, réponse
 * proposée (EN + FR, ZH si l'usine écrit en chinois) et questions de l'usine,
 * en séparant celles que seul le client peut trancher. Rien n'est envoyé ni
 * enregistré : l'équipe relit.
 */
export const REPLY_MODEL = process.env.PROJECT_REPLY_MODEL || FLASH_MODEL;
export async function analyzeExchange(projectId: string, input: { docIds: string[]; notes: string; supplierId: string | null }, actor: Actor): Promise<{ result: ExchangeAnalysis; usage: AiUsage }> {
  const parts: LlmPart[] = [];
  for (const id of input.docIds.slice(0, 6)) {
    const url = await imageDataUrl(projectId, id);
    if (url) parts.push({ type: 'image', url });
  }
  if (!parts.length && !input.notes.trim()) throw new ProjectError('Joignez au moins une capture d’écran ou collez le texte de l’échange.');
  const [{ data: p }, { data: s }] = await Promise.all([
    supabaseAdmin.from('projects').select('title, rfq_context, rfq_sender').eq('id', projectId).maybeSingle(),
    input.supplierId ? supabaseAdmin.from('project_suppliers').select('id, lot, alias, real_name').eq('id', input.supplierId).eq('project_id', projectId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!p) throw new ProjectError('Projet introuvable', 404);
  const [{ data: rfq }, { data: history }] = await Promise.all([
    s ? supabaseAdmin.from('project_rfq_messages').select('product_en, quantities_en, requirements_en').eq('project_id', projectId).eq('lot', s.lot).maybeSingle() : Promise.resolve({ data: null }),
    s ? supabaseAdmin.from('project_supplier_exchanges').select('exchanged_at, channel, summary').eq('project_id', projectId).eq('supplier_id', s.id).order('exchanged_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const ctx = (p.rfq_context && typeof p.rfq_context === 'object' ? p.rfq_context : {}) as { project_en?: string; requirements_en?: string[] };
  const sender = (p.rfq_sender && typeof p.rfq_sender === 'object' ? p.rfq_sender : {}) as { name?: string; company?: string };
  const system = exchangeAnalysisPrompt({
    company: COUNTRY.senderName,
    project: ctx.project_en || p.title,
    lot: s?.lot || null,
    factory: s ? `${s.real_name || s.alias} (${s.alias})` : null,
    product: rfq?.product_en || null,
    quantities: rfq?.quantities_en || null,
    requirements: [...(ctx.requirements_en || []), ...((rfq?.requirements_en as string[] | null) || [])].slice(0, 10),
    history: ((history || []) as { exchanged_at: string; channel: string; summary: string }[]).map((h) => `${new Date(h.exchanged_at).toLocaleDateString('fr-FR')} (${h.channel}) : ${h.summary.replace(/\s+/g, ' ').slice(0, 280)}`),
    sender: [sender.name, sender.company].filter(Boolean).join(', ') || null,
  });
  parts.push({ type: 'text', text: `${parts.length ? `${parts.length} capture(s) d’écran ci-dessus. ` : ''}${input.notes.trim() ? `Texte ou notes de l’équipe :\n${input.notes.trim().slice(0, 8000)}` : 'Aucun texte.'}\nDate du jour : ${new Date().toLocaleDateString('fr-FR', { timeZone: COUNTRY.timezone })}.` });
  const { json, usage } = await ask({ system, parts, model: REPLY_MODEL, maxTokens: 4000, projectId, actor, usage: 'analyse échange usine' });
  const result = validateExchangeAnalysis(json);
  if (!result) throw new ProjectError('Analyse illisible ; réessayez ou complétez à la main.', 502);
  return { result, usage };
}
