// Analyse d'une conversation : validation stricte de la réponse du modèle
// (listes fermées, défauts, jamais d'exception) et correction du stade d'achat
// par les faits (commandes du même numéro). Module pur, testé.

import {
  DEFAULTS,
  INTENTS,
  LANGUAGES,
  NEXT_ACTIONS,
  OBJECTIONS,
  PAYMENT_METHODS,
  RESOLUTION,
  RISKS,
  SENTIMENTS,
  STAGES,
  TRANSPORT_PREFS,
  URGENCY,
  type Choice,
  type Stage,
} from './taxonomy';

export interface ProductMention {
  label: string;
  quantity: number | null;
  priceMentioned: number | null;
}
export interface TeamGap {
  question: string;
  suggestedAnswer: string | null;
}
export interface ConversationAnalysis {
  sentiment: string;
  urgencyLevel: string;
  resolutionStatus: string;
  satisfactionScore: number | null;
  customerNeedSummary: string | null;
  topicTags: string[];
  language: string;
  intentCategory: string;
  /** Stade final (avis du modèle corrigé par les faits). */
  purchaseStage: Stage;
  /** Avis du modèle, avant correction. */
  llmStage: Stage;
  /** Stade déduit des commandes (null si aucune). */
  factStage: Stage | null;
  purchaseIntentScore: number | null;
  productsMentioned: ProductMention[];
  cartEstimate: number | null;
  objections: string[];
  transportPreference: string;
  paymentMethodMentioned: string;
  deliveryZone: string | null;
  abandonRisk: string;
  abandonReason: string | null;
  upsellOpportunity: string | null;
  nextBestAction: string;
  nextBestActionNote: string | null;
  teamGaps: TeamGap[];
}

const oneOf = (choices: Choice[], v: unknown, def: string): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  const hit = choices.find((c) => c.value.toLowerCase() === s.toLowerCase());
  return hit ? hit.value : def;
};
const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t && !/^(null|none|n\/a|aucun|aucune)$/i.test(t) ? t.slice(0, max) : null;
};
const num = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Réponse brute du modèle → analyse valide. Valeurs inconnues → défauts. */
export function validateAnalysis(raw: unknown): Omit<ConversationAnalysis, 'factStage'> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const objections = Array.from(new Set(arr(r.objections).map((o) => oneOf(OBJECTIONS, o, '')).filter(Boolean)));
  const stage = oneOf(STAGES, r.purchaseStage, DEFAULTS.purchaseStage) as Stage;
  const risk = oneOf(RISKS, r.abandonRisk, DEFAULTS.abandonRisk);
  return {
    sentiment: oneOf(SENTIMENTS, r.sentiment, DEFAULTS.sentiment),
    urgencyLevel: oneOf(URGENCY, r.urgencyLevel, DEFAULTS.urgencyLevel),
    resolutionStatus: oneOf(RESOLUTION, r.resolutionStatus, DEFAULTS.resolutionStatus),
    satisfactionScore: num(r.satisfactionScore, 0, 100),
    customerNeedSummary: text(r.customerNeedSummary, 300),
    topicTags: arr(r.topicTags).map((t) => text(t, 40)).filter((t): t is string => !!t).slice(0, 5),
    language: oneOf(LANGUAGES, r.language, DEFAULTS.language),
    intentCategory: oneOf(INTENTS, r.intentCategory, DEFAULTS.intentCategory),
    purchaseStage: stage,
    llmStage: stage,
    purchaseIntentScore: num(r.purchaseIntentScore, 0, 100),
    productsMentioned: arr(r.productsMentioned)
      .map((p) => {
        const o = (p && typeof p === 'object' ? p : { label: p }) as Record<string, unknown>;
        const label = text(o.label ?? o.name, 120);
        return label ? { label, quantity: num(o.quantity, 0, 1_000_000), priceMentioned: num(o.priceMentioned ?? o.price, 0, 1e12) } : null;
      })
      .filter((p): p is ProductMention => !!p)
      .slice(0, 5),
    cartEstimate: num(r.cartEstimate ?? r.cartEstimateXAF, 0, 1e12),
    objections: objections.length > 1 ? objections.filter((o) => o !== 'NONE') : objections,
    transportPreference: oneOf(TRANSPORT_PREFS, r.transportPreference, DEFAULTS.transportPreference),
    paymentMethodMentioned: oneOf(PAYMENT_METHODS, r.paymentMethodMentioned, DEFAULTS.paymentMethodMentioned),
    deliveryZone: text(r.deliveryZone, 80),
    abandonRisk: risk,
    abandonReason: risk === 'HIGH' ? text(r.abandonReason, 200) : null,
    upsellOpportunity: text(r.upsellOpportunity, 200),
    nextBestAction: oneOf(NEXT_ACTIONS, r.nextBestAction, DEFAULTS.nextBestAction),
    nextBestActionNote: text(r.nextBestActionNote, 300),
    teamGaps: arr(r.teamGaps)
      .map((g) => {
        const o = (g && typeof g === 'object' ? g : { question: g }) as Record<string, unknown>;
        const question = text(o.question, 240);
        return question ? { question, suggestedAnswer: text(o.suggestedAnswer, 400) } : null;
      })
      .filter((g): g is TeamGap => !!g)
      .slice(0, 3),
  };
}

// ---- Faits : commandes du même numéro ----
export interface OrderFact {
  payment_status: string | null;
  status: string | null;
  transport_mode: string | null;
  created_at: string;
}
const RANK: Record<string, number> = { BROWSING: 0, CONSIDERING: 1, READY_TO_BUY: 2, ORDERED: 3, POST_PURCHASE: 4 };
const SHIPPED = new Set(['shipped', 'at_agency', 'delivered']);

/** Stade minimal prouvé par les commandes : expédiée → après achat, payée → commandé, paiement engagé → prêt à acheter, panier → réflexion. */
export function stageFromOrders(orders: OrderFact[]): Stage | null {
  let best: Stage | null = null;
  const up = (s: Stage) => {
    if (!best || RANK[s] > RANK[best]) best = s;
  };
  for (const o of orders) {
    if (o.payment_status === 'paid' && o.status && SHIPPED.has(o.status)) up('POST_PURCHASE');
    else if (o.payment_status === 'paid') up('ORDERED');
    else if (o.payment_status === 'submitted') up('READY_TO_BUY');
    else up('CONSIDERING');
  }
  return best;
}

/** Stade final : le plus avancé entre l'avis du modèle et les faits (un « perdu » cède devant une commande). */
export function applyFacts(a: Omit<ConversationAnalysis, 'factStage'>, orders: OrderFact[]): ConversationAnalysis {
  const factStage = stageFromOrders(orders);
  let stage: Stage = a.llmStage;
  if (factStage) {
    if (stage === 'LOST') stage = RANK[factStage] >= RANK.ORDERED ? factStage : 'LOST';
    else if (RANK[factStage] > RANK[stage]) stage = factStage;
  }
  return { ...a, purchaseStage: stage, factStage };
}

/** Coût en FCFA à partir des tokens (tarifs en USD par million de tokens). */
export function costFcfa(inputTokens: number, outputTokens: number, prices: { inPerM: number; outPerM: number; usdToFcfa: number }): number {
  const usd = (inputTokens * prices.inPerM + outputTokens * prices.outPerM) / 1_000_000;
  return Math.round(usd * prices.usdToFcfa * 100) / 100;
}
