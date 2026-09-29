// Analyse IA des conversations WhatsApp — taxonomie déclarative (29 sept. 2026).
// Une seule taxonomie « commerce » : valeurs fermées, libellés français,
// défauts. Ce qui varie d'un pays à l'autre (devise, moyens de paiement, ville,
// délais) est injecté depuis COUNTRY, jamais écrit ici. Module pur, partagé
// entre le serveur (validation, prompt) et l'interface (libellés, couleurs).

export interface Choice {
  value: string;
  label: string;
}

const list = <T extends string>(entries: [T, string][]) => entries.map(([value, label]) => ({ value, label }));

export const SENTIMENTS = list([
  ['POSITIVE', 'Positif'],
  ['NEUTRAL', 'Neutre'],
  ['NEGATIVE', 'Négatif'],
]);
export const URGENCY = list([
  ['LOW', 'Faible'],
  ['MEDIUM', 'Moyenne'],
  ['HIGH', 'Élevée'],
]);
export const RESOLUTION = list([
  ['RESOLVED', 'Résolue'],
  ['PENDING', 'En cours'],
  ['UNRESOLVED', 'Non résolue'],
]);
export const INTENTS = list([
  ['PRODUCT_QUESTION', 'Question produit'],
  ['PRICE_QUESTION', 'Demande de prix'],
  ['PRICE_NEGOTIATION', 'Négociation de prix'],
  ['AVAILABILITY_VARIANT', 'Stock / variante'],
  ['TRANSPORT_QUESTION', 'Transport (avion, bateau, délais)'],
  ['ORDER_PLACEMENT', 'Passage de commande'],
  ['PAYMENT', 'Paiement'],
  ['ORDER_STATUS', 'Suivi de commande'],
  ['SOURCING_REQUEST', 'Produit hors catalogue'],
  ['B2B_PROJECT', 'Projet clé en main'],
  ['COMPLAINT', 'Réclamation'],
  ['AFTER_SALES', 'Après-vente'],
  ['PROMOTION_INQUIRY', 'Promotion'],
  ['GENERAL', 'Général'],
]);
export const STAGES = list([
  ['BROWSING', 'Découverte'],
  ['CONSIDERING', 'Réflexion'],
  ['READY_TO_BUY', 'Prêt à acheter'],
  ['ORDERED', 'Commandé'],
  ['POST_PURCHASE', 'Après achat'],
  ['LOST', 'Perdu'],
]);
export const OBJECTIONS = list([
  ['PRICE', 'Prix'],
  ['TRANSPORT_COST', 'Coût du transport'],
  ['TRANSIT_DELAY', 'Délai de livraison'],
  ['TRUST', 'Confiance (payer avant de recevoir)'],
  ['PAYMENT_METHOD', 'Moyen de paiement'],
  ['STOCK', 'Stock'],
  ['MOQ', 'Quantité minimale'],
  ['QUALITY_DOUBT', 'Doute sur la qualité'],
  ['SIZE_FIT', 'Taille / dimensions'],
  ['NONE', 'Aucune'],
]);
export const TRANSPORT_PREFS = list([
  ['AIR', 'Avion'],
  ['SEA', 'Bateau'],
  ['MIXED', 'Fractionné'],
  ['UNKNOWN', 'Non précisé'],
]);
export const PAYMENT_METHODS = list([
  ['MOBILE_MONEY', 'Mobile money'],
  ['CASH_AGENCY', 'Espèces à l’agence'],
  ['CARD', 'Carte'],
  ['BANK_TRANSFER', 'Virement'],
  ['NONE', 'Non précisé'],
]);
export const RISKS = list([
  ['LOW', 'Faible'],
  ['MEDIUM', 'Moyen'],
  ['HIGH', 'Élevé'],
]);
/** Prochaine action : chacune ouvre un outil qui existe déjà dans la messagerie. */
export const NEXT_ACTIONS = list([
  ['SEND_LISTING', 'Envoyer le listing'],
  ['SEND_SELECTION', 'Envoyer une sélection'],
  ['CREATE_CART', 'Créer le panier'],
  ['SEND_QUOTE', 'Envoyer un devis'],
  ['SEND_PAYMENT_INSTRUCTIONS', 'Envoyer les instructions de paiement'],
  ['CONFIRM_TRANSPORT', 'Faire choisir le transport'],
  ['SOURCING_REQUEST', 'Lancer une recherche produit'],
  ['FOLLOW_UP_24H', 'Relancer sous 24 h'],
  ['ESCALATE_ADMIN', 'Passer à l’admin'],
  ['NONE', 'Rien à faire'],
]);
export const LANGUAGES = list([
  ['fr', 'Français'],
  ['en', 'Anglais'],
  ['other', 'Autre'],
]);

export type Stage = 'BROWSING' | 'CONSIDERING' | 'READY_TO_BUY' | 'ORDERED' | 'POST_PURCHASE' | 'LOST';

/** Défauts : une valeur absente ou inconnue retombe ici. */
export const DEFAULTS = {
  sentiment: 'NEUTRAL',
  urgencyLevel: 'LOW',
  resolutionStatus: 'PENDING',
  intentCategory: 'GENERAL',
  purchaseStage: 'BROWSING' as Stage,
  transportPreference: 'UNKNOWN',
  paymentMethodMentioned: 'NONE',
  abandonRisk: 'LOW',
  nextBestAction: 'NONE',
  language: 'fr',
} as const;

export function labelOf(choices: Choice[], value: string | null | undefined): string {
  return choices.find((c) => c.value === value)?.label || value || '—';
}

/** Couleurs des badges de la messagerie (classes Tailwind). */
export const STAGE_TONE: Record<string, string> = {
  BROWSING: 'bg-slate-100 text-slate-600',
  CONSIDERING: 'bg-sky-100 text-sky-700',
  READY_TO_BUY: 'bg-emerald-100 text-emerald-800',
  ORDERED: 'bg-violet-100 text-violet-700',
  POST_PURCHASE: 'bg-indigo-100 text-indigo-700',
  LOST: 'bg-red-100 text-red-700',
};
export const RISK_TONE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-700',
};

/** Contexte du pays injecté dans le prompt (depuis COUNTRY, jamais en dur). */
export interface PromptCountry {
  brand: string;
  currency: string;
  mainCity: string;
  paymentLabels: string[];
  transitAir: string;
  transitSea: string;
}

const values = (c: Choice[]) => c.map((x) => x.value).join('|');

/**
 * Prompt système (≈ 900 tokens) : rôle, contexte du commerce, format JSON
 * strict avec les listes fermées. Le dialogue est envoyé à part.
 */
export function buildSystemPrompt(c: PromptCountry): string {
  return [
    `Tu analyses des conversations WhatsApp entre des clients et l'équipe de ${c.brand}, commerce d'import depuis la Chine basé à ${c.mainCity}.`,
    `Contexte : listings « maison » (particuliers) et « business clé en main » (ex. équiper une pizzeria), prix en ${c.currency}, transport aérien (${c.transitAir}) ou maritime (${c.transitSea}) ou fractionné, paiement ${c.paymentLabels.join(', ')}, livraison à domicile ou retrait à l'agence. L'équipe répond à la main (pas de robot).`,
    `Lignes du dialogue : [client HH:MM] ou [équipe HH:MM] ; [photo], [vocal], [fiche : …] = fiche produit envoyée par l'équipe. Les numéros sont masqués.`,
    `Réponds UNIQUEMENT par un objet JSON avec exactement ces clés :`,
    `{"sentiment":"${values(SENTIMENTS)}","urgencyLevel":"${values(URGENCY)}","resolutionStatus":"${values(RESOLUTION)}","satisfactionScore":0-100,`,
    `"customerNeedSummary":"1 phrase en français","topicTags":["0 à 5 mots"],"language":"${values(LANGUAGES)}",`,
    `"intentCategory":"${values(INTENTS)}",`,
    `"purchaseStage":"${values(STAGES)}","purchaseIntentScore":0-100,`,
    `"productsMentioned":[{"label":"tel que le client le nomme","quantity":null,"priceMentioned":null}],`,
    `"cartEstimate":null ou montant en ${c.currency},"objections":["${values(OBJECTIONS)}"],`,
    `"transportPreference":"${values(TRANSPORT_PREFS)}","paymentMethodMentioned":"${values(PAYMENT_METHODS)}",`,
    `"deliveryZone":null ou "quartier/ville","abandonRisk":"${values(RISKS)}","abandonReason":null ou "raison courte",`,
    `"upsellOpportunity":null ou "produit complémentaire","nextBestAction":"${values(NEXT_ACTIONS)}","nextBestActionNote":"1 phrase utilisable par l'équipe",`,
    `"teamGaps":[{"question":"question du client restée sans réponse ou traitée vaguement","suggestedAnswer":"réponse type courte ou null"}]}`,
    `Règles : productsMentioned 0 à 5, teamGaps 0 à 3 ; ne rien inventer (null ou liste vide si absent) ; SOURCING_REQUEST = produit absent du catalogue ; B2B_PROJECT = projet d'équipement complet ; READY_TO_BUY = le client veut commander ou payer ; LOST = refus clair ou silence après objection forte ; nextBestActionNote en français, concret.`,
  ].join('\n');
}
