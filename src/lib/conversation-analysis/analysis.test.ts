import { describe, expect, it } from 'vitest';
import { applyFacts, costFcfa, stageFromOrders, validateAnalysis } from './analysis';
import { buildDialogue, looksLikePhone, maskPersonalData, messageLine, shouldAnalyze, type DialogueMessage } from './dialogue';
import { aggregateReport, isHot, normalizeLabel, reportPromptInput, type AnalyzedConversation } from './report';
import { buildSystemPrompt } from './taxonomy';
import { parseJsonLoose } from '@/lib/llm';

const full = {
  sentiment: 'POSITIVE', urgencyLevel: 'high', resolutionStatus: 'PENDING', satisfactionScore: 80,
  customerNeedSummary: 'Veut équiper une pizzeria à Owendo', topicTags: ['pizzeria', 'four'], language: 'fr',
  intentCategory: 'B2B_PROJECT', purchaseStage: 'READY_TO_BUY', purchaseIntentScore: 85,
  productsMentioned: [{ label: 'Four à pizza', quantity: 1, priceMentioned: '450 000' }],
  cartEstimate: 1200000, objections: ['TRANSPORT_COST', 'TRANSIT_DELAY'], transportPreference: 'SEA',
  paymentMethodMentioned: 'MOBILE_MONEY', deliveryZone: 'Owendo', abandonRisk: 'HIGH', abandonReason: 'Trouve le fret trop cher',
  upsellOpportunity: 'Pétrin', nextBestAction: 'CREATE_CART', nextBestActionNote: 'Créer le panier four + pétrin en maritime.',
  teamGaps: [{ question: 'Livrez-vous à Owendo ?', suggestedAnswer: 'Oui, livraison à domicile à Owendo.' }],
};

describe('validateAnalysis — réponse complète, partielle, malformée', () => {
  it('complète : valeurs gardées, casse corrigée, montants lus', () => {
    const a = validateAnalysis(full);
    expect(a).toMatchObject({ urgencyLevel: 'HIGH', intentCategory: 'B2B_PROJECT', purchaseStage: 'READY_TO_BUY', llmStage: 'READY_TO_BUY', purchaseIntentScore: 85, abandonRisk: 'HIGH', abandonReason: 'Trouve le fret trop cher', nextBestAction: 'CREATE_CART' });
    expect(a.productsMentioned).toEqual([{ label: 'Four à pizza', quantity: 1, priceMentioned: 450000 }]);
    expect(a.objections).toEqual(['TRANSPORT_COST', 'TRANSIT_DELAY']);
  });
  it('partielle : défauts, listes vides, pas de raison sans risque élevé', () => {
    const a = validateAnalysis({ purchaseStage: 'BUYING_NOW', abandonReason: 'x', objections: ['NONE', 'PRICE', 'bof'] });
    expect(a).toMatchObject({ sentiment: 'NEUTRAL', intentCategory: 'GENERAL', purchaseStage: 'BROWSING', abandonRisk: 'LOW', abandonReason: null, nextBestAction: 'NONE', productsMentioned: [], teamGaps: [] });
    expect(a.objections).toEqual(['PRICE']);
  });
  it('malformée : jamais d’exception', () => {
    for (const raw of [null, 'texte', 42, [], { productsMentioned: 'four', teamGaps: ['Question ?'], satisfactionScore: 'beaucoup', purchaseIntentScore: 250 }]) {
      expect(() => validateAnalysis(raw)).not.toThrow();
    }
    const a = validateAnalysis({ productsMentioned: 'four', teamGaps: ['Question ?'], purchaseIntentScore: 250, deliveryZone: 'null' });
    expect(a.purchaseIntentScore).toBe(100);
    expect(a.teamGaps).toEqual([{ question: 'Question ?', suggestedAnswer: null }]);
    expect(a.deliveryZone).toBeNull();
  });
  it('JSON approximatif du modèle', () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Voici : {"a":2} merci')).toEqual({ a: 2 });
    expect(parseJsonLoose('rien')).toBeNull();
  });
});

describe('stade corrigé par les faits', () => {
  const o = (payment_status: string, status: string | null = null) => ({ payment_status, status, transport_mode: 'sea', created_at: 't' });
  it('payée expédiée → après achat ; payée → commandé ; engagée → prêt ; panier → réflexion', () => {
    expect(stageFromOrders([o('paid', 'shipped')])).toBe('POST_PURCHASE');
    expect(stageFromOrders([o('pending'), o('paid')])).toBe('ORDERED');
    expect(stageFromOrders([o('submitted')])).toBe('READY_TO_BUY');
    expect(stageFromOrders([o('pending')])).toBe('CONSIDERING');
    expect(stageFromOrders([])).toBeNull();
  });
  it('le plus avancé l’emporte ; « perdu » cède devant une commande payée, pas devant un panier', () => {
    const base = validateAnalysis({ purchaseStage: 'BROWSING' });
    expect(applyFacts(base, [o('submitted')])).toMatchObject({ purchaseStage: 'READY_TO_BUY', llmStage: 'BROWSING', factStage: 'READY_TO_BUY' });
    const lost = validateAnalysis({ purchaseStage: 'LOST' });
    expect(applyFacts(lost, [o('paid')]).purchaseStage).toBe('ORDERED');
    expect(applyFacts(lost, [o('pending')]).purchaseStage).toBe('LOST');
    expect(applyFacts(validateAnalysis(full), []).factStage).toBeNull();
  });
  it('coût en FCFA', () => {
    expect(costFcfa(2000, 500, { inPerM: 1, outPerM: 3, usdToFcfa: 600 })).toBe(2.1);
  });
});

describe('dialogue : masquage, lignes, troncature, seuils', () => {
  it('numéros et e-mails masqués, prix intacts', () => {
    expect(maskPersonalData('Appelez le 077 12 34 56 ou +241 77123456, mail a.b@x.ga')).toBe('Appelez le [numéro] ou [numéro], mail [e-mail]');
    expect(maskPersonalData('Le four coûte 1 250 000 FCFA, 3 pièces')).toBe('Le four coûte 1 250 000 FCFA, 3 pièces');
    expect(looksLikePhone('2250707070707')).toBe(true);
    expect(looksLikePhone('1250000')).toBe(false);
  });
  const m = (i: number, from_me: boolean, extra: Partial<DialogueMessage> = {}): DialogueMessage => ({ id: `m${i}`, from_me, type: 'text', text: `message ${i}`, media_kind: null, filename: null, sent_at: new Date(Date.UTC(2026, 8, 29, 8, i)).toISOString(), ...extra });
  it('médias et fiches produit lisibles', () => {
    expect(messageLine(m(1, false, { media_kind: 'image', text: 'ce modèle ?' }))).toBe('[photo] ce modèle ?');
    expect(messageLine(m(2, true, { text: 'Four 60 cm', context: { buttons: [{ title: 'Voir le produit', url: 'u' }] } }))).toBe('[fiche : Four 60 cm + boutons Voir le produit]');
  });
  it('au-delà de 30 messages : le premier + les 29 derniers, origine en tête', () => {
    const msgs = Array.from({ length: 45 }, (_, i) => m(i, i % 2 === 1));
    const d = buildDialogue(msgs, 'Africa/Libreville', { adTitle: 'Pizzeria clé en main', listingTitle: 'Ajoutez une Pizzeria' });
    expect(d).toMatchObject({ kept: 30, total: 45 });
    expect(d.text.split('\n')[0]).toBe('Origine : pub « Pizzeria clé en main », listing « Ajoutez une Pizzeria ».');
    expect(d.text).toContain('[client 09:00] message 0');
    expect(d.text).toContain('[… 15 messages non repris …]');
    expect(d.text).toContain('[client 09:44] message 44');
  });
  it('seuils : 2 messages client, 30 min de calme, du nouveau', () => {
    const now = new Date(Date.UTC(2026, 8, 29, 12));
    const two = [m(1, false), m(2, true), m(3, false)];
    expect(shouldAnalyze({ messages: [m(1, false), m(2, true)], lastAnalyzedMessageId: null, now }).ok).toBe(false);
    expect(shouldAnalyze({ messages: two, lastAnalyzedMessageId: null, now }).ok).toBe(true);
    expect(shouldAnalyze({ messages: two, lastAnalyzedMessageId: 'm3', now })).toEqual({ ok: false, reason: 'rien de nouveau' });
    expect(shouldAnalyze({ messages: two, lastAnalyzedMessageId: null, now: new Date(Date.UTC(2026, 8, 29, 8, 20)) })).toEqual({ ok: false, reason: 'conversation en cours' });
    expect(shouldAnalyze({ messages: two, lastAnalyzedMessageId: 'm3', now, force: true }).ok).toBe(true);
  });
  it('prompt système compact avec le contexte du pays', () => {
    const p = buildSystemPrompt({ brand: 'Oh My Gab', currency: 'XAF', mainCity: 'Libreville', paymentLabels: ['Airtel Money', 'espèces à l’agence'], transitAir: '8 à 14 j', transitSea: '60 à 85 j' });
    expect(p).toContain('Libreville');
    expect(p).toContain('Airtel Money');
    expect(p.length).toBeLessThan(6000); // ≈ 1 500 tokens
  });
});

describe('rapport : agrégations sur des conversations fictives', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  const row = (id: string, over: Record<string, unknown>, extra: Partial<AnalyzedConversation> = {}): AnalyzedConversation => ({
    conversation_id: id, listing_title: 'Pizzeria', ad_title: null, last_inbound_at: '2026-09-29T08:00:00Z', last_outbound_at: '2026-09-29T09:00:00Z', has_cart: false,
    analysis: applyFacts(validateAnalysis({ ...full, ...over }), []), ...extra,
  });
  const rows = [
    row('c1', {}),
    row('c2', { productsMentioned: [{ label: 'four a pizza' }], teamGaps: [{ question: 'Livrez-vous à Owendo ?' }], objections: ['PRICE'], deliveryZone: 'owendo' }, { last_outbound_at: null }),
    row('c3', { purchaseStage: 'BROWSING', purchaseIntentScore: 20, abandonRisk: 'LOW', intentCategory: 'SOURCING_REQUEST', productsMentioned: [{ label: 'Machine à glace' }], objections: ['NONE'], teamGaps: [], deliveryZone: null }, { listing_title: null, ad_title: 'Canapés', has_cart: true }),
  ];
  const r = aggregateReport(rows, now);
  it('stades, produits regroupés, hors catalogue, objections par listing, zones', () => {
    expect(r.analyzed).toBe(3);
    expect(r.stages).toEqual({ READY_TO_BUY: 2, BROWSING: 1 });
    expect(r.topProducts[0]).toEqual({ label: 'Four à pizza', count: 2, unanswered: 2 });
    expect(r.sourcingRequests).toEqual([{ label: 'Machine à glace', count: 1 }]);
    expect(r.objections[0]).toEqual({ value: 'TRANSPORT_COST', count: 1 });
    expect(r.objectionsByListing[0].listing).toBe('Pizzeria');
    expect(r.deliveryZones).toEqual([{ zone: 'Owendo', count: 2 }]);
    expect(r.highRiskRate).toBeCloseTo(2 / 3);
  });
  it('CA estimé des « prêts à acheter » sans panier, questions regroupées, relances > 24 h', () => {
    expect(r.readyWithoutCart).toBe(2);
    expect(r.estimatedPendingRevenue).toBe(2_400_000);
    expect(r.teamGaps[0]).toMatchObject({ question: 'Livrez-vous à Owendo ?', count: 2, suggestedAnswer: 'Oui, livraison à domicile à Owendo.' });
    expect(r.followUps.map((f) => f.conversation_id)).toEqual(['c2']);
    expect(isHot({ purchaseStage: 'CONSIDERING', purchaseIntentScore: 75 })).toBe(true);
    expect(normalizeLabel('Four à Pizza !')).toBe('four a pizza');
  });
  it('le modèle ne reçoit que des statistiques', () => {
    const input = reportPromptInput(r, { pendingCarts: 4, pendingCartsTotal: 900000, currency: 'XAF', period: '29/09/2026' });
    expect(input).not.toContain('message');
    expect(JSON.parse(input).paniers_non_payes).toEqual({ nombre: 4, montant: 900000, devise: 'XAF' });
  });
});
