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
import { chatCompletion, llmPrices, parseJsonLoose } from '@/lib/llm';
import { conversationOrigin, bucketKey } from '@/lib/admin-activity';
import { applyFacts, costFcfa, validateAnalysis, type ConversationAnalysis, type OrderFact } from './analysis';
import { buildDialogue, shouldAnalyze, type DialogueMessage } from './dialogue';
import { aggregateReport, REPORT_SYSTEM_PROMPT, reportPromptInput, type AnalyzedConversation, type ReportBreakdown } from './report';
import { buildSystemPrompt } from './taxonomy';

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
async function ordersOfPhone(phone: string): Promise<(OrderFact & { id: string })[]> {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return [];
  const { data } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_phone, payment_status, status, transport_mode, created_at')
    .ilike('client_phone', `%${digits.slice(-8)}`)
    .limit(50);
  return ((data || []) as (OrderFact & { id: string; client_phone: string })[]).filter((o) => {
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
export async function analyzeConversation(conversationId: string, opts: { force?: boolean; dryRun?: boolean; triggeredBy?: string; withDialogue?: boolean } = {}): Promise<AnalyzeResult> {
  const { data: conv } = await supabaseAdmin.from('wa_conversations').select('*').eq('id', conversationId).maybeSingle();
  if (!conv) return { ok: false, error: 'Conversation introuvable' };
  const c = conv as ConvRow;

  const [{ data: recent }, { data: first }] = await Promise.all([
    supabaseAdmin.from('wa_messages').select('*').eq('conversation_id', c.id).order('sent_at', { ascending: false }).limit(MESSAGE_WINDOW),
    supabaseAdmin.from('wa_messages').select('*').eq('conversation_id', c.id).order('sent_at', { ascending: true }).limit(1),
  ]);
  const byId = new Map<string, DialogueMessage>();
  for (const m of [...((first || []) as DialogueMessage[]), ...((recent || []) as DialogueMessage[])]) byId.set(m.id, m);
  const messages = [...byId.values()].sort((a, b) => a.sent_at.localeCompare(b.sent_at));

  const gate = shouldAnalyze({ messages, lastAnalyzedMessageId: c.analyzed_message_id ?? null, force: opts.force });
  if (!gate.ok) return { ok: false, skipped: gate.reason };

  if (!opts.dryRun && (await spentToday()) >= dailyBudgetFcfa()) return { ok: false, skipped: 'plafond de coût du jour atteint' };

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
    maxTokens: 900,
    timeoutMs: 45_000,
  });
  if (!llm.ok) {
    console.error(`[analysis] ${c.id} : ${llm.error}`);
    return { ok: false, error: llm.error };
  }
  const orders = await ordersOfPhone(c.phone);
  const analysis = applyFacts(validateAnalysis(parseJsonLoose(llm.text)), orders);
  const cost = costFcfa(llm.inputTokens, llm.outputTokens, llmPrices(llm.provider));
  const usage = { model: llm.model, inputTokens: llm.inputTokens, outputTokens: llm.outputTokens, costFcfa: cost };
  const lastId = messages[messages.length - 1]?.id || null;
  const result: AnalyzeResult = { ok: true, analysis, listingId: origin.listingId, usage, dialogue: { kept: dialogue.kept, total: dialogue.total, ...(opts.withDialogue ? { text: dialogue.text } : {}) } };
  if (opts.dryRun) return result;

  const now = new Date().toISOString();
  const { error: insErr } = await supabaseAdmin.from('wa_conversation_analyses').insert({
    conversation_id: c.id,
    analyzed_at: now,
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
      if (/Migration|Clé/.test(r.error)) break;
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
export async function analyzedConversationsSince(sinceIso: string | null, dayKey?: string): Promise<{ rows: AnalyzedConversation[]; cost: number }> {
  let q = supabaseAdmin.from('wa_conversation_analyses').select('conversation_id, analyzed_at, commerce, listing_id, cost_fcfa').order('analyzed_at', { ascending: false }).limit(5000);
  if (sinceIso) q = q.gte('analyzed_at', sinceIso);
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
export async function pendingCarts(): Promise<{ count: number; total: number }> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabaseAdmin
    .from('offer_orders')
    .select('grand_total_fcfa, items_total_fcfa')
    .eq('payment_status', 'pending')
    .not('transport_mode', 'is', null)
    .neq('client_phone', '')
    .gte('created_at', since)
    .limit(5000);
  const list = (data || []) as { grand_total_fcfa: number | null; items_total_fcfa: number | null }[];
  return { count: list.length, total: Math.round(list.reduce((s, o) => s + (Number(o.grand_total_fcfa ?? o.items_total_fcfa) || 0), 0)) };
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

/** Rapport du jour (fuseau du pays), idempotent : upsert par date. */
export async function buildDailyReport(now: Date = new Date()): Promise<{ ok: boolean; report?: DailyReport; error?: string }> {
  const dayKey = bucketKey(now.toISOString(), 'day', COUNTRY.timezone);
  let data: { rows: AnalyzedConversation[]; cost: number };
  try {
    data = await analyzedConversationsSince(new Date(now.getTime() - 36 * 3_600_000).toISOString(), dayKey);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur' };
  }
  const breakdown = aggregateReport(data.rows, now);
  const pc = await pendingCarts();
  let insights: string[] = [];
  let recommendations: string | null = null;
  let usage = { model: null as string | null, inputTokens: 0, outputTokens: 0, cost: 0 };
  if (breakdown.analyzed > 0) {
    const llm = await chatCompletion({
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: reportPromptInput(breakdown, { pendingCarts: pc.count, pendingCartsTotal: pc.total, currency: currencyLabel(), period: dayKey }) }],
      jsonMode: true,
      maxTokens: 900,
    });
    if (llm.ok) {
      const j = (parseJsonLoose(llm.text) || {}) as { insights?: unknown; recommendations?: unknown };
      insights = Array.isArray(j.insights) ? j.insights.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean).slice(0, 6) : [];
      recommendations = typeof j.recommendations === 'string' ? j.recommendations.trim().slice(0, 2000) : null;
      usage = { model: llm.model, inputTokens: llm.inputTokens, outputTokens: llm.outputTokens, cost: costFcfa(llm.inputTokens, llm.outputTokens, llmPrices(llm.provider)) };
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
  return { ok: true, report };
}

export async function reportExists(dayKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('wa_daily_reports').select('id').eq('report_date', dayKey).maybeSingle();
  return !!data;
}

export async function latestReport(): Promise<DailyReport | null> {
  const { data } = await supabaseAdmin.from('wa_daily_reports').select('*').order('report_date', { ascending: false }).limit(1).maybeSingle();
  return (data as DailyReport | null) || null;
}

export async function latestAnalysis(conversationId: string): Promise<(ConversationAnalysis & { analyzed_at: string; cost_fcfa: number; model: string | null }) | null> {
  const { data, error } = await supabaseAdmin
    .from('wa_conversation_analyses')
    .select('commerce, analyzed_at, cost_fcfa, model')
    .eq('conversation_id', conversationId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as { commerce: ConversationAnalysis; analyzed_at: string; cost_fcfa: number; model: string | null };
  return { ...d.commerce, analyzed_at: d.analyzed_at, cost_fcfa: Number(d.cost_fcfa) || 0, model: d.model };
}
