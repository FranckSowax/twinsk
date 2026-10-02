// Analyse IA des conversations — côté serveur (supabaseAdmin). Charge la
// conversation, décide s'il faut l'analyser, construit le dialogue masqué,
// appelle le modèle (src/lib/llm.ts), valide, corrige le stade par les
// commandes, enregistre l'analyse et le résumé sur la conversation. Rapport
// quotidien à partir des analyses du jour. Tolère l'absence de la migration
// du 29 sept. 2026 (erreurs signalées, jamais d'exception vers l'appelant).

import { supabaseAdmin } from '@/lib/supabase/server';
import { COUNTRY } from '@/config/countries';
import { CONTENT } from '@/content';
import { formatPrice, transitLabel } from '@/lib/country';
import { chatCompletion, llmCostFcfa, parseJsonLoose } from '@/lib/llm';
import { conversationOrigin, bucketKey } from '@/lib/admin-activity';
import { applyFacts, validateAnalysis, type ConversationAnalysis, type OrderFact } from './analysis';
import { buildDialogue, shouldAnalyze, type DialogueMessage } from './dialogue';
import { aggregateReport, REPORT_SYSTEM_PROMPT, reportPromptInput, type AnalyzedConversation, type ReportBreakdown } from './report';
import { buildSystemPrompt } from './taxonomy';
import { dayBounds, isDayKey } from './days';

const MESSAGE_WINDOW = 200;

/** Libellé de la devise tel que l'app l'affiche (« FCFA »). */
export function currencyLabel(): string {
  return formatPrice(0).replace(/[\d\s  .,]/g, '').trim() || COUNTRY.currency;
}
export function systemPrompt(): string {
  return buildSystemPrompt({
    brand: COUNTRY.brand,
    currency: currencyLabel(),
    mainCity: COUNTRY.mainCity,
    paymentLabels: [CONTENT.payment.cartShort],
    transitAir: transitLabel(COUNTRY.transit.air),
    transitSea: transitLabel(COUNTRY.transit.sea),
  });
}

export function dailyBudgetFcfa(): number {
  const v = Number(process.env.ANALYSIS_DAILY_BUDGET_FCFA);
  return Number.isFinite(v) && v > 0 ? v : 500;
}
export function batchLimit(): number {
  const v = Number(process.env.ANALYSIS_BATCH_LIMIT);
  return Number.isFinite(v) && v > 0 ? Math.min(200, v) : 40;
}

interface ConvRow {
  id: string;
  phone: string;
  source?: { type?: string; title?: string | null } | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  analyzed_at?: string | null;
  analyzed_message_id?: string | null;
}

/** Commandes du même numéro (rapprochement par les 8 derniers chiffres puis égalité stricte). */
async function ordersOfPhone(phone: string, asOf?: string): Promise<(OrderFact & { id: string })[]> {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return [];
  const { data } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_phone, payment_status, status, transport_mode, created_at')
    .ilike('client_phone', `%${digits.slice(-8)}`)
    .limit(50);
  return ((data || []) as (OrderFact & { id: string; client_phone: string })[]).filter((o) => {
    // Analyse « à une date » : seules les commandes déjà créées à cette date comptent.
    if (asOf && o.created_at && o.created_at > asOf) return false;
    const d = (o.client_phone || '').replace(/\D/g, '');
    return d === digits || d.endsWith(digits) || digits.endsWith(d);
  });
}

/** Dépense du jour (fuseau du pays) en FCFA, pour le plafond quotidien. */
export async function spentToday(now: Date = new Date()): Promise<number> {
  const today = bucketKey(now.toISOString(), 'day', COUNTRY.timezone);
  const { data } = await supabaseAdmin
    .from('wa_conversation_analyses')
    .select('analyzed_at, cost_fcfa')
    .gte('analyzed_at', new Date(now.getTime() - 36 * 3_600_000).toISOString());
  return ((data || []) as { analyzed_at: string; cost_fcfa: number }[])
    .filter((r) => bucketKey(r.analyzed_at, 'day', COUNTRY.timezone) === today)
    .reduce((s, r) => s + (Number(r.cost_fcfa) || 0), 0);
}

export interface AnalyzeResult {
  ok: boolean;
  skipped?: string;
  error?: string;
  analysis?: ConversationAnalysis;
  listingId?: string | null;
  usage?: { model: string; inputTokens: number; outputTokens: number; costFcfa: number };
  dialogue?: { kept: number; total: number; text?: string };
}

/**
 * Analyse une conversation. `force` : ignore les seuils de calme et de
 * nouveauté (ré-analyse manuelle). `dryRun` : n'écrit rien (test à blanc).
 */
/**
 * Analyse une conversation. Avec `asOf` (ISO) : état de la conversation à cet
 * instant (messages envoyés jusqu'à `asOf`), enregistré avec analyzed_at = asOf,
 * sans toucher à l'état courant de la conversation — sert au rapport d'un jour
 * passé et au rattrapage. Idempotent : une analyse déjà faite sur le même
 * dernier message n'est pas refaite.
 */
export async function analyzeConversation(conversationId: string, opts: { force?: boolean; dryRun?: boolean; triggeredBy?: string; withDialogue?: boolean; asOf?: string; ignoreDailyBudget?: boolean } = {}): Promise<AnalyzeResult> {
  const { data: conv } = await supabaseAdmin.from('wa_conversations').select('*').eq('id', conversationId).maybeSingle();
  if (!conv) return { ok: false, error: 'Conversation introuvable' };
  const c = conv as ConvRow;

  const [{ data: recent }, { data: first }] = await Promise.all([
    (opts.asOf ? supabaseAdmin.from('wa_messages').select('*').eq('conversation_id', c.id).lte('sent_at', opts.asOf) : supabaseAdmin.from('wa_messages').select('*').eq('conversation_id', c.id)).order('sent_at', { ascending: false }).limit(MESSAGE_WINDOW),
    supabaseAdmin.from('wa_messages').select('*').eq('conversation_id', c.id).order('sent_at', { ascending: true }).limit(1),
  ]);
  const byId = new Map<string, DialogueMessage>();
  for (const m of [...((first || []) as DialogueMessage[]), ...((recent || []) as DialogueMessage[])]) byId.set(m.id, m);
  const messages = [...byId.values()].filter((m) => !opts.asOf || m.sent_at <= opts.asOf).sort((a, b) => a.sent_at.localeCompare(b.sent_at));

  if (opts.asOf) {
    if (!messages.length) return { ok: false, skipped: 'aucun message à cette date' };
    // Déjà analysée sur ce même dernier message : rien à refaire.
    const lastMsg = messages[messages.length - 1].id;
    const { data: done } = await supabaseAdmin.from('wa_conversation_analyses').select('id').eq('conversation_id', c.id).eq('last_message_id', lastMsg).limit(1);
    if (done?.length && !opts.force) return { ok: false, skipped: 'déjà analysée' };
  } else {
    const gate = shouldAnalyze({ messages, lastAnalyzedMessageId: c.analyzed_message_id ?? null, force: opts.force });
    if (!gate.ok) return { ok: false, skipped: gate.reason };
  }

  if (!opts.dryRun && !opts.ignoreDailyBudget && (await spentToday()) >= dailyBudgetFcfa()) return { ok: false, skipped: 'plafond de coût du jour atteint' };

  // Origine : pub (son texte contient souvent le lien du listing), sinon premier lien de listing échangé.
  const origin = conversationOrigin({
    adBodies: messages.map((m) => m.context?.ad?.body || '').filter(Boolean),
    adTitle: c.source?.title || null,
    fromAd: c.source?.type === 'ad',
    linkTexts: messages.map((m) => m.text || '').filter((t) => t.includes('/offer/')),
  });
  let listingTitle: string | null = null;
  if (origin.listingId) {
    const { data: o } = await supabaseAdmin.from('offers').select('title').eq('id', origin.listingId).maybeSingle();
    listingTitle = (o as { title?: string } | null)?.title || null;
  }

  const dialogue = buildDialogue(messages, COUNTRY.timezone, { adTitle: origin.adTitle, listingTitle });
  const llm = await chatCompletion({
    system: systemPrompt(),
    messages: [{ role: 'user', content: `Conversation à analyser :\n${dialogue.text}\n\nRéponds uniquement par le JSON demandé.` }],
    jsonMode: true,
    // Le raisonnement (obligatoire sur GLM Flash) consomme une partie du budget : marge pour les longues conversations.
    maxTokens: 3500,
    timeoutMs: 90_000,
  });
  if (!llm.ok) {
    console.error(`[analysis] ${c.id} : ${llm.error}`);
    return { ok: false, error: llm.error };
  }
  // JSON illisible : on n'enregistre pas une fiche remplie de valeurs par défaut.
  const parsed = parseJsonLoose(llm.text);
  if (!parsed || typeof parsed !== 'object') {
    console.error(`[analysis] ${c.id} : réponse non JSON (${llm.text.slice(0, 120)})`);
    return { ok: false, error: 'Réponse du modèle illisible (pas de JSON)' };
  }
  const orders = await ordersOfPhone(c.phone, opts.asOf);
  const analysis = applyFacts(validateAnalysis(parsed), orders);
  const cost = llmCostFcfa(llm);
  const usage = { model: llm.model, inputTokens: llm.inputTokens, outputTokens: llm.outputTokens, costFcfa: cost };
  const lastId = messages[messages.length - 1]?.id || null;
  const result: AnalyzeResult = { ok: true, analysis, listingId: origin.listingId, usage, dialogue: { kept: dialogue.kept, total: dialogue.total, ...(opts.withDialogue ? { text: dialogue.text } : {}) } };
  if (opts.dryRun) return result;

  const now = new Date().toISOString();
  const { error: insErr } = await supabaseAdmin.from('wa_conversation_analyses').insert({
    conversation_id: c.id,
    analyzed_at: opts.asOf && opts.asOf < now ? opts.asOf : now,
    last_message_id: lastId,
    message_count: dialogue.total,
    sentiment: analysis.sentiment,
    urgency_level: analysis.urgencyLevel,
    resolution_status: analysis.resolutionStatus,
    satisfaction_score: analysis.satisfactionScore,
    customer_need_summary: analysis.customerNeedSummary,
    topic_tags: analysis.topicTags,
    language: analysis.language,
    intent_category: analysis.intentCategory,
    purchase_stage: analysis.purchaseStage,
    purchase_intent_score: analysis.purchaseIntentScore,
    abandon_risk: analysis.abandonRisk,
    next_best_action: analysis.nextBestAction,
    commerce: analysis,
    listing_id: origin.listingId,
    model: llm.model,
    input_tokens: llm.inputTokens,
    output_tokens: llm.outputTokens,
    cost_fcfa: cost,
    triggered_by: opts.triggeredBy || 'cron',
  });
  if (insErr) {
    console.error(`[analysis] non enregistrée (${c.id}) : ${insErr.message}`);
    return { ...result, ok: false, error: /does not exist|schema cache/i.test(insErr.message) ? 'Migration « conversation_analysis » non appliquée' : insErr.message };
  }
  // Une analyse « à une date passée » ne remplace pas l'état courant de la conversation.
  if (opts.asOf && opts.asOf < now && c.last_message_at && c.last_message_at > opts.asOf) return result;
  await supabaseAdmin
    .from('wa_conversations')
    .update({
      purchase_stage: analysis.purchaseStage,
      purchase_intent_score: analysis.purchaseIntentScore,
      abandon_risk: analysis.abandonRisk,
      next_best_action: analysis.nextBestAction,
      analyzed_at: now,
      analyzed_message_id: lastId,
    })
    .eq('id', c.id);
  return result;
}

/** Passage du cron : conversations modifiées depuis leur dernière analyse et calmes depuis 30 min. */
export async function runAnalysisBatch(limit = batchLimit()): Promise<{ analyzed: number; skipped: number; errors: string[]; costFcfa: number; stoppedByBudget: boolean }> {
  const out = { analyzed: 0, skipped: 0, errors: [] as string[], costFcfa: 0, stoppedByBudget: false };
  const quiet = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, last_message_at, analyzed_at')
    .lte('last_message_at', quiet)
    .order('last_message_at', { ascending: false })
    .limit(limit * 5);
  if (error) {
    out.errors.push(/analyzed_at/.test(error.message) ? 'Migration « conversation_analysis » non appliquée' : error.message);
    return out;
  }
  const todo = ((data || []) as { id: string; last_message_at: string | null; analyzed_at: string | null }[]).filter(
    (c) => !c.analyzed_at || (c.last_message_at && c.last_message_at > c.analyzed_at),
  );
  for (const c of todo) {
    if (out.analyzed >= limit) break;
    const r = await analyzeConversation(c.id, { triggeredBy: 'cron' });
    if (r.ok) {
      out.analyzed += 1;
      out.costFcfa += r.usage?.costFcfa || 0;
    } else if (r.skipped === 'plafond de coût du jour atteint') {
      out.stoppedByBudget = true;
      break;
    } else if (r.skipped) out.skipped += 1;
    else if (r.error) {
      out.errors.push(r.error);
      // Erreur qui toucherait tout le lot (migration, clé, solde) : on s'arrête.
      if (/Migration|Clé|insufficient|suspended|balance|credit| 401 | 402 /i.test(r.error)) break;
    }
  }
  out.costFcfa = Math.round(out.costFcfa * 100) / 100;
  return out;
}

// ---- Rapport ----
interface AnalysisRow {
  conversation_id: string;
  analyzed_at: string;
  commerce: ConversationAnalysis;
  listing_id: string | null;
  cost_fcfa: number;
}

/** Dernière analyse de chaque conversation analysée depuis `sinceIso`, avec le contexte nécessaire au rapport. */
export async function analyzedConversationsSince(sinceIso: string | null, dayKey?: string, range?: { end?: string; ids?: string[] }): Promise<{ rows: AnalyzedConversation[]; cost: number }> {
  let q = supabaseAdmin.from('wa_conversation_analyses').select('conversation_id, analyzed_at, commerce, listing_id, cost_fcfa').order('analyzed_at', { ascending: false }).limit(5000);
  if (sinceIso) q = q.gte('analyzed_at', sinceIso);
  if (range?.end) q = q.lte('analyzed_at', range.end);
  if (range?.ids) {
    if (!range.ids.length) return { rows: [], cost: 0 };
    q = q.in('conversation_id', range.ids);
  }
  const { data, error } = await q;
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? 'Migration « conversation_analysis » non appliquée' : error.message);
  let list = (data || []) as AnalysisRow[];
  if (dayKey) list = list.filter((r) => bucketKey(r.analyzed_at, 'day', COUNTRY.timezone) === dayKey);
  const cost = list.reduce((s, r) => s + (Number(r.cost_fcfa) || 0), 0);
  const latest = new Map<string, AnalysisRow>();
  for (const r of list) if (!latest.has(r.conversation_id)) latest.set(r.conversation_id, r);
  const ids = [...latest.keys()];
  if (!ids.length) return { rows: [], cost };

  const [{ data: convs }, { data: offers }] = await Promise.all([
    supabaseAdmin.from('wa_conversations').select('id, phone, source, last_inbound_at, last_outbound_at').in('id', ids),
    supabaseAdmin.from('offers').select('id, title').in('id', [...new Set([...latest.values()].map((r) => r.listing_id).filter(Boolean))] as string[]),
  ]);
  const convMap = new Map(((convs || []) as (ConvRow & { phone: string })[]).map((c) => [c.id, c]));
  const titles = new Map(((offers || []) as { id: string; title: string }[]).map((o) => [o.id, o.title]));
  // Paniers existants par numéro (pour « prêt à acheter sans panier »).
  const { data: carts } = await supabaseAdmin.from('offer_orders').select('client_phone').neq('client_phone', '').limit(5000);
  const cartDigits = new Set(((carts || []) as { client_phone: string }[]).map((o) => o.client_phone.replace(/\D/g, '').slice(-8)));

  const rows: AnalyzedConversation[] = [];
  for (const [id, r] of latest) {
    const c = convMap.get(id);
    if (!c) continue;
    rows.push({
      conversation_id: id,
      listing_title: r.listing_id ? titles.get(r.listing_id) || null : null,
      ad_title: c.source?.title || null,
      last_inbound_at: c.last_inbound_at,
      last_outbound_at: c.last_outbound_at,
      has_cart: cartDigits.has(c.phone.replace(/\D/g, '').slice(-8)),
      analysis: r.commerce,
    });
  }
  return { rows, cost };
}

/** Paniers non payés avec transport choisi (30 derniers jours) : le chiffre d'affaires en suspens réel. */
export async function pendingCarts(asOf?: string): Promise<{ count: number; total: number }> {
  // Pour un jour passé : paniers créés dans les 30 jours précédant la fin du jour et toujours en attente
  // (le statut historique n'est pas conservé : approximation documentée).
  const ref = asOf ? new Date(asOf).getTime() : Date.now();
  const since = new Date(ref - 30 * 86_400_000).toISOString();
  let q = supabaseAdmin
    .from('offer_orders')
    .select('grand_total_fcfa, items_total_fcfa')
    .eq('payment_status', 'pending')
    .not('transport_mode', 'is', null)
    .neq('client_phone', '')
    .gte('created_at', since);
  if (asOf) q = q.lte('created_at', asOf);
  const { data } = await q.limit(5000);
  const list = (data || []) as { grand_total_fcfa: number | null; items_total_fcfa: number | null }[];
  return { count: list.length, total: Math.round(list.reduce((s, o) => s + (Number(o.grand_total_fcfa ?? o.items_total_fcfa) || 0), 0)) };
}

/** Conversations ayant échangé au moins un message pendant le jour local `dayKey`. */
export async function conversationsActiveOn(dayKey: string): Promise<string[]> {
  const { start, end } = dayBounds(dayKey, COUNTRY.timezone);
  const ids = new Set<string>();
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabaseAdmin.from('wa_messages').select('conversation_id').gte('sent_at', start).lt('sent_at', end).order('sent_at').range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const m of (data || []) as { conversation_id: string }[]) ids.add(m.conversation_id);
    if (!data || data.length < 1000) break;
  }
  return [...ids];
}

async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

/**
 * Analyse toutes les conversations actives du jour qui ne l'ont pas encore été
 * (aujourd'hui : état courant ; jour passé : état à la fin du jour). En parallèle,
 * avec un plafond de coût pour l'appel.
 */
export async function ensureDayAnalyses(dayKey: string, opts: { now?: Date; concurrency?: number; maxCostFcfa?: number; triggeredBy?: string } = {}): Promise<{ active: number; analyzed: number; skipped: number; errors: string[]; costFcfa: number; stoppedByBudget: boolean }> {
  const now = opts.now || new Date();
  const { end } = dayBounds(dayKey, COUNTRY.timezone);
  const isPast = end <= now.toISOString();
  const ids = await conversationsActiveOn(dayKey);
  const out = { active: ids.length, analyzed: 0, skipped: 0, errors: [] as string[], costFcfa: 0, stoppedByBudget: false };
  const cap = opts.maxCostFcfa ?? dailyBudgetFcfa();
  await mapLimit(ids, opts.concurrency ?? 6, async (id) => {
    if (out.costFcfa >= cap) { out.stoppedByBudget = true; return; }
    // Jour passé : état à la fin du jour ; aujourd'hui : état à cet instant (même si la
    // conversation est en cours ou n'a qu'un message client — le rapport les couvre toutes).
    const r = await analyzeConversation(id, { asOf: isPast ? end : new Date().toISOString(), ignoreDailyBudget: isPast, triggeredBy: opts.triggeredBy || 'report' });
    if (r.ok) { out.analyzed += 1; out.costFcfa += r.usage?.costFcfa || 0; }
    else if (r.skipped === 'plafond de coût du jour atteint') out.stoppedByBudget = true;
    else if (r.skipped) out.skipped += 1;
    else if (r.error) out.errors.push(r.error);
  });
  out.costFcfa = Math.round(out.costFcfa * 100) / 100;
  return out;
}

export interface DailyReport {
  report_date: string;
  analyzed_count: number;
  breakdown: ReportBreakdown;
  pending_carts: number;
  pending_carts_total: number;
  insights: string[];
  recommendations: string | null;
  cost_fcfa: number;
  updated_at?: string;
}

/**
 * Rapport d'un jour (fuseau du pays ; par défaut aujourd'hui), idempotent :
 * upsert par date. Porte sur les conversations ACTIVES ce jour-là ; avec
 * `ensure` (défaut), analyse d'abord celles qui ne l'ont pas encore été.
 */
export async function buildDailyReport(input: Date | { day?: string; now?: Date; ensure?: boolean; maxCostFcfa?: number } = new Date()): Promise<{ ok: boolean; report?: DailyReport; error?: string; ensured?: Awaited<ReturnType<typeof ensureDayAnalyses>> }> {
  const opts = input instanceof Date ? { now: input } : input;
  const realNow = opts.now || new Date();
  const dayKey = isDayKey(opts.day) ? opts.day : bucketKey(realNow.toISOString(), 'day', COUNTRY.timezone);
  const { start, end } = dayBounds(dayKey, COUNTRY.timezone);
  const isPast = end <= realNow.toISOString();
  const asOf = isPast ? end : realNow.toISOString();
  let ensured: Awaited<ReturnType<typeof ensureDayAnalyses>> | undefined;
  let data: { rows: AnalyzedConversation[]; cost: number };
  try {
    if (opts.ensure !== false) ensured = await ensureDayAnalyses(dayKey, { now: realNow, maxCostFcfa: opts.maxCostFcfa });
    const ids = await conversationsActiveOn(dayKey);
    // Borne haute prise APRÈS les analyses (sinon celles qu'on vient de faire seraient exclues).
    data = await analyzedConversationsSince(start, undefined, { end: isPast ? end : new Date().toISOString(), ids });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur' };
  }
  const now = isPast ? new Date(asOf) : new Date();
  const breakdown = aggregateReport(data.rows, now);
  const pc = await pendingCarts(isPast ? end : undefined);
  let insights: string[] = [];
  let recommendations: string | null = null;
  let usage = { model: null as string | null, inputTokens: 0, outputTokens: 0, cost: 0 };
  if (breakdown.analyzed > 0) {
    const llm = await chatCompletion({
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: reportPromptInput(breakdown, { pendingCarts: pc.count, pendingCartsTotal: pc.total, currency: currencyLabel(), period: dayKey }) }],
      jsonMode: true,
      maxTokens: 2000,
    });
    if (llm.ok) {
      const j = (parseJsonLoose(llm.text) || {}) as { insights?: unknown; recommendations?: unknown };
      insights = Array.isArray(j.insights) ? j.insights.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).slice(0, 6) : [];
      recommendations = typeof j.recommendations === 'string' ? j.recommendations.trim().slice(0, 2000) : null;
      usage = { model: llm.model, inputTokens: llm.inputTokens, outputTokens: llm.outputTokens, cost: llmCostFcfa(llm) };
    } else console.error(`[analysis] rapport : ${llm.error}`);
  }
  const report: DailyReport = {
    report_date: dayKey,
    analyzed_count: breakdown.analyzed,
    breakdown,
    pending_carts: pc.count,
    pending_carts_total: pc.total,
    insights,
    recommendations,
    cost_fcfa: Math.round((data.cost + usage.cost) * 100) / 100,
  };
  const { error } = await supabaseAdmin
    .from('wa_daily_reports')
    .upsert({ ...report, model: usage.model, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, updated_at: new Date().toISOString() }, { onConflict: 'report_date' });
  if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? 'Migration « conversation_analysis » non appliquée' : error.message };
  return { ok: true, report, ensured };
}

export async function reportExists(dayKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('wa_daily_reports').select('id').eq('report_date', dayKey).maybeSingle();
  return !!data;
}

/** Rapport d'une date précise, ou null. */
export async function reportByDate(dayKey: string): Promise<DailyReport | null> {
  const { data } = await supabaseAdmin.from('wa_daily_reports').select('*').eq('report_date', dayKey).maybeSingle();
  return (data as DailyReport | null) || null;
}

/** Dates des rapports disponibles (plus récent d'abord). */
export async function reportDates(limit = 90): Promise<string[]> {
  const { data } = await supabaseAdmin.from('wa_daily_reports').select('report_date').order('report_date', { ascending: false }).limit(limit);
  return ((data || []) as { report_date: string }[]).map((r) => r.report_date);
}

export async function latestReport(): Promise<DailyReport | null> {
  const { data } = await supabaseAdmin.from('wa_daily_reports').select('*').order('report_date', { ascending: false }).limit(1).maybeSingle();
  return (data as DailyReport | null) || null;
}

export type StoredAnalysis = ConversationAnalysis & { analyzed_at: string; cost_fcfa: number; model: string | null; listing_id: string | null; triggered_by: string | null };
export async function latestAnalysis(conversationId: string): Promise<StoredAnalysis | null> {
  const { data, error } = await supabaseAdmin
    .from('wa_conversation_analyses')
    .select('commerce, analyzed_at, cost_fcfa, model, listing_id, triggered_by')
    .eq('conversation_id', conversationId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as { commerce: ConversationAnalysis; analyzed_at: string; cost_fcfa: number; model: string | null; listing_id: string | null; triggered_by: string | null };
  return { ...d.commerce, analyzed_at: d.analyzed_at, cost_fcfa: Number(d.cost_fcfa) || 0, model: d.model, listing_id: d.listing_id, triggered_by: d.triggered_by };
}
