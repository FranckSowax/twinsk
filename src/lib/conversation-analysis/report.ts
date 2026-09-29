// Rapport des conversations analysées : agrégations pures (testées). Le modèle
// ne reçoit que ces statistiques, jamais les dialogues.

import type { ConversationAnalysis } from './analysis';

export interface AnalyzedConversation {
  conversation_id: string;
  listing_title: string | null;
  ad_title: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  has_cart: boolean;
  analysis: ConversationAnalysis;
}

export interface ReportBreakdown {
  analyzed: number;
  stages: Record<string, number>;
  intents: Record<string, number>;
  sentiments: Record<string, number>;
  risks: Record<string, number>;
  nextActions: Record<string, number>;
  topProducts: { label: string; count: number; unanswered: number }[];
  sourcingRequests: { label: string; count: number }[];
  objections: { value: string; count: number }[];
  objectionsByListing: { listing: string; objections: Record<string, number> }[];
  deliveryZones: { zone: string; count: number }[];
  highRiskRate: number | null;
  avgIntentScore: number | null;
  /** Estimations du modèle : conversations « prêt à acheter » sans panier. */
  estimatedPendingRevenue: number;
  readyWithoutCart: number;
  teamGaps: { question: string; count: number; suggestedAnswer: string | null }[];
  /** Conversations chaudes sans réponse de l'équipe depuis plus de 24 h. */
  followUps: { conversation_id: string; summary: string | null; stage: string; intent: number | null; hoursWaiting: number }[];
}

const inc = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] || 0) + 1;
};
/** Libellé normalisé pour regrouper « Four à pizza », « four a pizza  »… */
export function normalizeLabel(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function top<T extends { count: number }>(items: T[], n: number): T[] {
  return [...items].sort((a, b) => b.count - a.count).slice(0, n);
}

export function isHot(a: Pick<ConversationAnalysis, 'purchaseStage' | 'purchaseIntentScore'>): boolean {
  return a.purchaseStage === 'READY_TO_BUY' || (a.purchaseIntentScore ?? 0) >= 70;
}

export function aggregateReport(rows: AnalyzedConversation[], now: Date = new Date()): ReportBreakdown {
  const stages: Record<string, number> = {};
  const intents: Record<string, number> = {};
  const sentiments: Record<string, number> = {};
  const risks: Record<string, number> = {};
  const nextActions: Record<string, number> = {};
  const products = new Map<string, { label: string; count: number; unanswered: number }>();
  const sourcing = new Map<string, { label: string; count: number }>();
  const objections: Record<string, number> = {};
  const byListing = new Map<string, Record<string, number>>();
  const zones = new Map<string, { zone: string; count: number }>();
  const gaps = new Map<string, { question: string; count: number; suggestedAnswer: string | null }>();
  let intentSum = 0;
  let intentN = 0;
  let pending = 0;
  let readyWithoutCart = 0;
  const followUps: ReportBreakdown['followUps'] = [];

  for (const r of rows) {
    const a = r.analysis;
    inc(stages, a.purchaseStage);
    inc(intents, a.intentCategory);
    inc(sentiments, a.sentiment);
    inc(risks, a.abandonRisk);
    inc(nextActions, a.nextBestAction);
    if (a.purchaseIntentScore != null) {
      intentSum += a.purchaseIntentScore;
      intentN += 1;
    }
    const unanswered = a.resolutionStatus === 'UNRESOLVED' || a.teamGaps.length > 0;
    for (const p of a.productsMentioned) {
      const k = normalizeLabel(p.label);
      if (!k) continue;
      const e = products.get(k) || { label: p.label, count: 0, unanswered: 0 };
      e.count += 1;
      if (unanswered) e.unanswered += 1;
      products.set(k, e);
      if (a.intentCategory === 'SOURCING_REQUEST') {
        const s = sourcing.get(k) || { label: p.label, count: 0 };
        s.count += 1;
        sourcing.set(k, s);
      }
    }
    const listing = r.listing_title || (r.ad_title ? `Pub : ${r.ad_title}` : 'Sans listing identifié');
    for (const o of a.objections) {
      if (o === 'NONE') continue;
      inc(objections, o);
      const m = byListing.get(listing) || {};
      inc(m, o);
      byListing.set(listing, m);
    }
    if (a.deliveryZone) {
      const k = normalizeLabel(a.deliveryZone);
      const z = zones.get(k) || { zone: a.deliveryZone, count: 0 };
      z.count += 1;
      zones.set(k, z);
    }
    for (const g of a.teamGaps) {
      const k = normalizeLabel(g.question).slice(0, 80);
      const e = gaps.get(k) || { question: g.question, count: 0, suggestedAnswer: g.suggestedAnswer };
      e.count += 1;
      if (!e.suggestedAnswer && g.suggestedAnswer) e.suggestedAnswer = g.suggestedAnswer;
      gaps.set(k, e);
    }
    if (a.purchaseStage === 'READY_TO_BUY' && !r.has_cart) {
      readyWithoutCart += 1;
      pending += a.cartEstimate || 0;
    }
    // Chaud et sans réponse de l'équipe depuis plus de 24 h.
    if (isHot(a) && r.last_inbound_at && (!r.last_outbound_at || r.last_outbound_at < r.last_inbound_at)) {
      const hours = (now.getTime() - new Date(r.last_inbound_at).getTime()) / 3_600_000;
      if (hours >= 24) followUps.push({ conversation_id: r.conversation_id, summary: a.customerNeedSummary, stage: a.purchaseStage, intent: a.purchaseIntentScore, hoursWaiting: Math.round(hours) });
    }
  }

  return {
    analyzed: rows.length,
    stages,
    intents,
    sentiments,
    risks,
    nextActions,
    topProducts: top([...products.values()], 10),
    sourcingRequests: top([...sourcing.values()], 10),
    objections: top(Object.entries(objections).map(([value, count]) => ({ value, count })), 10),
    objectionsByListing: [...byListing.entries()]
      .map(([listing, o]) => ({ listing, objections: o, total: Object.values(o).reduce((s, n) => s + n, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map(({ listing, objections: o }) => ({ listing, objections: o })),
    deliveryZones: top([...zones.values()], 10),
    highRiskRate: rows.length ? (risks.HIGH || 0) / rows.length : null,
    avgIntentScore: intentN ? Math.round(intentSum / intentN) : null,
    estimatedPendingRevenue: Math.round(pending),
    readyWithoutCart,
    teamGaps: top([...gaps.values()], 10),
    followUps: followUps.sort((a, b) => (b.intent ?? 0) - (a.intent ?? 0)).slice(0, 20),
  };
}

/** Statistiques compactes envoyées au modèle pour les recommandations (jamais de dialogue). */
export function reportPromptInput(b: ReportBreakdown, facts: { pendingCarts: number; pendingCartsTotal: number; currency: string; period: string }): string {
  return JSON.stringify({
    periode: facts.period,
    conversations_analysees: b.analyzed,
    stades: b.stages,
    intentions: b.intents,
    risque_abandon_eleve: b.highRiskRate,
    intention_moyenne: b.avgIntentScore,
    produits_demandes: b.topProducts,
    produits_hors_catalogue: b.sourcingRequests,
    objections: b.objections,
    objections_par_listing: b.objectionsByListing,
    zones: b.deliveryZones,
    questions_mal_traitees: b.teamGaps.map((g) => ({ question: g.question, fois: g.count })),
    relances_a_faire: b.followUps.length,
    paniers_non_payes: { nombre: facts.pendingCarts, montant: facts.pendingCartsTotal, devise: facts.currency },
    prets_a_acheter_sans_panier: { nombre: b.readyWithoutCart, estimation: b.estimatedPendingRevenue, devise: facts.currency },
  });
}

export const REPORT_SYSTEM_PROMPT =
  'Tu es responsable commercial d’un commerce d’import depuis la Chine qui vend sur WhatsApp. ' +
  'À partir des statistiques JSON du jour (jamais de dialogue), réponds UNIQUEMENT par un JSON : ' +
  '{"insights":["3 à 5 constats courts et chiffrés"],"recommendations":"un paragraphe de recommandations concrètes orientées ventes : relances à faire, listings à pousser ou à revoir, prix ou frais de transport contestés, réponses types à créer, produits hors catalogue à sourcer"}. ' +
  'Français, concret, sans inventer de chiffre absent des statistiques.';
