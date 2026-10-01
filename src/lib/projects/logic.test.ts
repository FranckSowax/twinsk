import { describe, expect, it } from 'vitest';
import { DOM_TOM_TEMPLATE } from './templates/dom-tom';
import { buildPlan, canAdvanceOrder, canCompleteTask, canUnvalidateLine, canValidateLine, groupByLot, initialPhases, isPhaseLocked, lineTotal, missingDailyUpdate, nextOrderStatus, previousBusinessDay, progress, quoteTotals, rankSuppliers, scoreTotal, supplierAlias, toggleChecklist, type QuoteLineLike } from './logic';
import { deepKeys, FORBIDDEN_PUBLIC_FIELDS, projectPublicView, type RawForPublic } from './public';

const START = '2026-10-05T08:00:00.000Z';

describe('plan généré depuis le modèle DOM-TOM', () => {
  const { steps, tasks } = buildPlan(DOM_TOM_TEMPLATE, START);
  it('8 étapes, tâches ordonnées, échéances calculées, checklists non cochées', () => {
    expect(steps).toHaveLength(8);
    expect(steps[0].title).toMatch(/Étape 0/);
    const t = tasks.find((x) => x.key === 'rfq-gazon')!;
    expect(t.due_at).toBe('2026-10-26T08:00:00.000Z'); // 3 semaines
    expect(t.checklist.every((c) => !c.done)).toBe(true);
    expect(t.checklist[0].id).toBe('rfq-gazon-1');
    expect(new Set(tasks.map((x) => x.key)).size).toBe(tasks.length);
  });
  it('phases : la phase 2 est verrouillée tant que la phase 1 n’est pas réceptionnée', () => {
    const phases = initialPhases(DOM_TOM_TEMPLATE);
    expect(isPhaseLocked(phases, 'phase1')).toBe(false);
    expect(isPhaseLocked(phases, 'phase2')).toBe(true);
    expect(isPhaseLocked(phases, null)).toBe(false);
    const received = phases.map((p) => (p.id === 'phase1' ? { ...p, received_at: '2027-05-01T00:00:00Z' } : p));
    expect(isPhaseLocked(received, 'phase2')).toBe(false);
  });
  it('règle des rôles : une tâche client ne se solde que par le client, une tâche verrouillée jamais', () => {
    const phases = initialPhases(DOM_TOM_TEMPLATE);
    expect(canCompleteTask({ owner: 'client', phase: null }, 'team', phases).ok).toBe(false);
    expect(canCompleteTask({ owner: 'client', phase: null }, 'client', phases).ok).toBe(true);
    expect(canCompleteTask({ owner: 'team', phase: null }, 'client', phases).ok).toBe(false);
    expect(canCompleteTask({ owner: 'team', phase: 'phase2' }, 'team', phases).ok).toBe(false);
  });
  it('progression par étape et globale', () => {
    const p = progress([
      { step_key: 'a', status: 'done' },
      { step_key: 'a', status: 'todo' },
      { step_key: 'b', status: 'todo' },
    ]);
    expect(p.global).toBeCloseTo(1 / 3);
    expect(p.bySteps).toEqual({ a: 0.5, b: 0 });
    expect(toggleChecklist([{ id: 'x', label: 'l', done: false }], 'x', true)[0].done).toBe(true);
  });
});

describe('devis : totaux et validation ligne par ligne', () => {
  const phases = initialPhases(DOM_TOM_TEMPLATE);
  const line = (o: Partial<QuoteLineLike>): QuoteLineLike => ({ id: 'l', lot: 'Gazon', quantity: 10, client_quantity: null, unit_price: 100, optional: false, enabled: true, status: 'draft', phase: null, ...o });
  it('quantité client prioritaire, option désactivée = 0, sans prix = null', () => {
    expect(lineTotal(line({}))).toBe(1000);
    expect(lineTotal(line({ client_quantity: 4 }))).toBe(400);
    expect(lineTotal(line({ optional: true, enabled: false }))).toBe(0);
    expect(lineTotal(line({ unit_price: null }))).toBeNull();
  });
  it('trois totaux : engagé, en attente, estimé ; lignes non chiffrées comptées', () => {
    const t = quoteTotals([line({ id: 'a', status: 'validated' }), line({ id: 'b', client_quantity: 2 }), line({ id: 'c', unit_price: null }), line({ id: 'd', optional: true, enabled: false })]);
    expect(t).toEqual({ committed: 1000, pending: 200, estimated: 1200, unpriced: 1 });
  });
  it('validation : chiffrée, active, quantité > 0, phase ouverte, encore en brouillon', () => {
    expect(canValidateLine(line({}), phases).ok).toBe(true);
    expect(canValidateLine(line({ unit_price: null }), phases).ok).toBe(false);
    expect(canValidateLine(line({ optional: true, enabled: false }), phases).ok).toBe(false);
    expect(canValidateLine(line({ client_quantity: 0 }), phases).ok).toBe(false);
    expect(canValidateLine(line({ phase: 'phase2' }), phases).ok).toBe(false);
    expect(canValidateLine(line({ status: 'validated' }), phases).ok).toBe(false);
    expect(canUnvalidateLine({ status: 'validated' })).toBe(true);
    expect(canUnvalidateLine({ status: 'ordered' })).toBe(false);
  });
  it('lots dans l’ordre d’apparition', () => {
    expect(groupByLot(DOM_TOM_TEMPLATE.quote_lines).map((g) => g.lot)).toEqual(['Gazon', 'Foot 5', 'Éclairage', 'Padel', 'Conteneurs', 'Options', 'Services', 'Logistique']);
  });
});

describe('commandes : stepper', () => {
  it('un pas en avant ou en arrière, jamais de saut', () => {
    expect(canAdvanceOrder('validated', 'issued')).toBe(true);
    expect(canAdvanceOrder('issued', 'validated')).toBe(true);
    expect(canAdvanceOrder('validated', 'production')).toBe(false);
    expect(nextOrderStatus('in_transit')).toBe('delivered');
    expect(nextOrderStatus('delivered')).toBeNull();
  });
});

describe('journal : jours ouvrés', () => {
  const tz = 'Africa/Libreville';
  it('jour ouvré précédent : lundi → vendredi ; mercredi → mardi', () => {
    expect(previousBusinessDay(new Date('2026-10-05T09:00:00Z'), tz)).toBe('2026-10-02'); // lundi → vendredi
    expect(previousBusinessDay(new Date('2026-10-07T09:00:00Z'), tz)).toBe('2026-10-06');
  });
  it('rappel seulement en jour ouvré, et seulement si rien n’a été publié la veille ouvrée', () => {
    expect(missingDailyUpdate([], new Date('2026-10-07T09:00:00Z'), tz)).toBe(true);
    expect(missingDailyUpdate(['2026-10-06T15:00:00Z'], new Date('2026-10-07T09:00:00Z'), tz)).toBe(false);
    expect(missingDailyUpdate([], new Date('2026-10-04T09:00:00Z'), tz)).toBe(false); // dimanche
  });
  it('alias fournisseurs', () => {
    expect(supplierAlias(0)).toBe('Fournisseur A');
    expect(supplierAlias(2)).toBe('Fournisseur C');
  });
});

describe('projection publique : aucun champ interdit ne sort', () => {
  const phases = initialPhases(DOM_TOM_TEMPLATE);
  const raw: RawForPublic = {
    project: { title: 'PSG Academy DOM-TOM', description: 'd', currency: 'USD', rates: { CNY: 0.14 }, cover_video_at: '2026-09-30T12:00:00Z', status: 'active', phases, business_trip_interested_at: null, business_trip_quote_requested_at: null },

    steps: [{ key: 's', title: 'S', description: '', position: 0 }],
    tasks: [{ id: 't1', step_key: 's', title: 'T', description: '', owner: 'client', phase: 'phase2', due_at: START, status: 'todo', checklist: [{ id: 'c', label: 'l', done: false }], attachments: [] }],
    taskComments: [{ id: 'k', task_id: 't1', author: 'team', author_name: 'Franck', text: 'ok', attachments: [], created_at: START }],
    updates: [{ id: 'u', title: 'Jour 1', body: 'b', attachments: [], published_at: START }],
    updateComments: [],
    questions: [{ id: 'q', subject: 'S', detail: 'D', attachment: null, status: 'open', created_at: START }, { id: 'q2', subject: 'Couleur des lignes de jeu ?', detail: 'Blanc ou jaune ?', attachment: null, status: 'open', direction: 'to_client', lot: 'Gazon', created_at: START }],
    questionReplies: [],
    documents: [{ id: 'd1', category: 'site', name: 'plan.pdf', size: 10, uploaded_by: 'Client', created_at: START }],
    quoteLines: [
      { id: 'l1', lot: 'Gazon', label: 'Gazon', unit: 'm²', quantity: 5800, client_quantity: null, unit_price: 12, price_currency: 'USD', validated_snapshot: null, optional: false, enabled: true, status: 'draft', phase: null, validated_at: null, supplier_id: 'sup1' },
      // Saisie en yuans : convertie au taux du projet (1 CNY = 0,14 USD).
      { id: 'l2', lot: 'Gazon', label: 'Shockpad', unit: 'm²', quantity: 100, client_quantity: null, unit_price: 30, price_currency: 'CNY', validated_snapshot: null, optional: false, enabled: true, status: 'draft', phase: null, validated_at: null, supplier_id: null },
      // Saisie en euros sans taux : non chiffrée tant que le taux manque.
      { id: 'l3', lot: 'Padel', label: 'Kit', unit: 'kit', quantity: 2, client_quantity: null, unit_price: 8000, price_currency: 'EUR', validated_snapshot: null, optional: false, enabled: true, status: 'draft', phase: null, validated_at: null, supplier_id: null },
      // Validée : l'instantané (prix converti au taux du jour de la validation) prime sur le taux courant.
      { id: 'l4', lot: 'Padel', label: 'LED', unit: 'pièce', quantity: 10, client_quantity: null, unit_price: 500, price_currency: 'CNY', validated_snapshot: { unit_price: 75, total: 750 }, optional: false, enabled: true, status: 'validated', phase: null, validated_at: START, supplier_id: null },
    ],
    orders: [],
    suppliers: [
      { id: 'sup1', lot: 'Gazon', alias: 'Fournisseur A', status: 'candidate', scores: { certifications: 4, tropical: 4, installation: 5, price: 3, transparency: 4 }, score: 21, description: 'Producteur de gazon depuis 2003.', product_specs: [{ label: 'Hauteur', value: '30 mm' }], certifications: ['ISO 9001', 'SGS'], years_experience: 23, capacity: '120 000 m²/jour', lead_time: '10–15 j', moq: null, sample_status: 'requested', country: 'Chine', product_photos: [{ doc_id: 'ph1', caption: 'Échantillon 30 mm' }] },
      { id: 'sup2', lot: 'Gazon', alias: 'Fournisseur B', status: 'selected', scores: { certifications: 3, tropical: 3, installation: 3, price: 5, transparency: 4 }, score: 18, description: null, product_specs: [], certifications: [], years_experience: null, capacity: null, lead_time: null, moq: null, sample_status: null, country: 'Chine', product_photos: [] },
    ],
    finalReports: [{ phase: 'phase1', checklist: [], delivered_at: null, file_id: null }],
    trips: [
      { id: 't1', title: 'Audit gazon', start_date: '2026-11-02', end_date: null, status: 'proposed', stops: [{ id: 'st', day: 1, date: null, city: 'Guangzhou', supplier_id: 'sup1', order_ids: [], line_ids: ['l1'], program: 'Contrôle', internal_note: 'Contact Lily' }], internal_note: 'budget', interested_at: null, interested_by: null, quote_requested_at: null, quote_requested_by: null, created_at: START },
      { id: 't2', title: 'Brouillon', start_date: null, end_date: null, status: 'draft', stops: [], internal_note: null, interested_at: null, interested_by: null, quote_requested_at: null, quote_requested_by: null, created_at: START },
    ],
    defaultMarginPct: 25,
    offers: [
      { id: 'o1', supplier_id: 'sup1', lot: 'Gazon', title: 'Offre 1', currency: 'CNY', incoterm: 'FOB', valid_until: null, lead_time: '15 j', moq: '2 000 m²', items: [{ id: 'g', kind: 'base', label: 'Gazon 30 mm', variant: {}, unit: 'm²', price: 35, tiers: [], per: 'unit', quote_line_id: 'l1' }], margin_mode: 'pct', margin_value: null, client_visible: true, status: 'active', client_interested_at: null, updated_at: START },
      { id: 'o2', supplier_id: 'sup2', lot: 'Gazon', title: 'Offre cachée', currency: 'USD', incoterm: 'FOB', valid_until: null, lead_time: null, moq: null, items: [{ id: 'g', kind: 'base', label: 'Secret', variant: {}, unit: 'm²', price: 3, tiers: [], per: 'unit', quote_line_id: null }], margin_mode: 'pct', margin_value: null, client_visible: false, status: 'active', client_interested_at: null, updated_at: START },
    ],
  };
  // Simule une base qui contiendrait ces champs sensibles : ils ne doivent jamais transiter.
  const polluted = JSON.parse(JSON.stringify(raw)) as RawForPublic & Record<string, unknown>;
  (polluted.suppliers[0] as Record<string, unknown>).real_name = 'Shenzhen Turf Co';
  (polluted.suppliers[0] as Record<string, unknown>).contact = 'wechat:xxx';
  Object.assign(polluted.suppliers[0] as Record<string, unknown>, { email: 'sales@turf.cn', whatsapp: '+8613800000000', wechat: 'turf_sales', contact_name: 'Lily', city: 'Leling', website: 'turf.cn', indicative_price: '4,8 USD/m²', internal_note: 'secret', watch_points: ['WhatsApp partagé avec une autre usine'] });
  (polluted as Record<string, unknown>).rfq = [{ short_zh: '您好' }];
  (polluted as Record<string, unknown>).rfq_sender = { name: 'Franck' };
  Object.assign(polluted.project as Record<string, unknown>, { cover_video_path: 'projet/cover-secret.mp4' });
  Object.assign(polluted.questions[1] as Record<string, unknown>, { supplier_id: 'sup1', exchange_id: 'ex-secret' });
  Object.assign((polluted.offers as unknown as Record<string, unknown>[])[0], { raw: 'texte usine', notes: 'note interne', payment_terms: 'T/T 30 %' });
  (polluted.quoteLines[0] as Record<string, unknown>).unit_cost = 7;
  (polluted as Record<string, unknown>).exchanges = [{ note: 'secret' }];
  const view = projectPublicView(polluted, 'TOKEN');
  it('champs interdits absents, alias et prix de vente présents', () => {
    const keys = deepKeys(view);
    for (const f of FORBIDDEN_PUBLIC_FIELDS) expect(keys.has(f), f).toBe(false);
    expect(JSON.stringify(view)).not.toContain('Shenzhen');
    expect(view.trips.map((t) => [t.title, t.stops[0]?.alias, t.stops[0]?.items])).toEqual([['Audit gazon', 'Fournisseur A', [view.quote.lines[0].label]]]);
    expect(JSON.stringify(view.trips)).not.toMatch(/Lily|budget|sup1/);
    expect(view.quote.lines[0]).toMatchObject({ supplier_alias: 'Fournisseur A', unit_price: 12, total: 69600 });
    expect(view.tasks[0].locked).toBe(true);
    expect(view.documents[0].download_path).toBe('/api/projects/public/TOKEN/documents/d1');
    expect(view.quote.totals).toEqual({ committed: 750, pending: 70020, estimated: 70770, unpriced: 1 });
  });
  it('devises : prix convertis dans la devise principale, taux manquant signalé, instantané figé', () => {
    const [l1, l2, l3, l4] = view.quote.lines;
    expect(l1).toMatchObject({ unit_price: 12, entered_price: 12, price_currency: 'USD', rate_missing: false });
    expect(l2).toMatchObject({ unit_price: 4.2, entered_price: 30, price_currency: 'CNY', total: 420 });
    expect(l3).toMatchObject({ unit_price: null, entered_price: 8000, price_currency: 'EUR', rate_missing: true, total: null });
    expect(l4).toMatchObject({ unit_price: 75, total: 750, status: 'validated' });
    expect(view.rates).toEqual({ CNY: 0.14 });
    // Vidéo de couverture : une version pour l'adresse …/cover?v=, jamais le chemin de stockage.
    expect(view.cover_video).toEqual({ version: String(Date.parse('2026-09-30T12:00:00Z')) });
    expect(JSON.stringify(view)).not.toContain('cover-secret');
    // Question de l'équipe au client : sens et lot visibles, usine et échange d'origine jamais.
    expect(view.questions.map((q) => [q.direction, q.lot])).toEqual([['from_client', null], ['to_client', 'Gazon']]);
    expect(JSON.stringify(view)).not.toContain('ex-secret');
    // Offres : seules les offres cochées, prix client (35 CNY × 0,14 = 4,90 $ + 25 % = 6,13 $), jamais le prix usine ni la marge.
    expect(view.offers.map((o) => [o.alias, o.items[0].price, o.items[0].qty, o.items[0].total])).toEqual([['Fournisseur A', 6.13, 5800, 35554]]);
    expect(JSON.stringify(view.offers)).not.toMatch(/"35"|Secret|margin|CNY/);
    expect(JSON.stringify(view)).not.toMatch(/Lily|Leling|turf\.cn|138000|secret|WhatsApp partagé/);
  });
  it('usines anonymisées : retenue en tête, note /25, fiche produit, rien d’autre', () => {
    expect(view.suppliers.map((s) => [s.alias, s.rank, s.status, s.score])).toEqual([['Fournisseur B', 1, 'selected', 18], ['Fournisseur A', 2, 'candidate', 20]]);
    expect(view.suppliers[1]).toMatchObject({ description: 'Producteur de gazon depuis 2003.', product_specs: [{ label: 'Hauteur', value: '30 mm' }], certifications: ['ISO 9001', 'SGS'], years_experience: 23, sample_status: 'requested', scores: { installation: 5 } });
    expect(Object.keys(view.suppliers[0]).sort()).toEqual(['alias', 'capacity', 'certifications', 'country', 'description', 'lead_time', 'lot', 'moq', 'photos', 'product_specs', 'rank', 'sample_status', 'score', 'scores', 'status', 'years_experience']);
    // Photos produit : adresse du lien client (vérifiée côté serveur), jamais l'identifiant de stockage seul.
    expect(view.suppliers[1].photos).toEqual([{ url: '/api/projects/public/TOKEN/photos/ph1', caption: 'Échantillon 30 mm' }]);
  });
});

describe('usines : notation /25 et classement par lot', () => {
  it('total des 5 critères, bornés 0-5 ; null sans note', () => {
    expect(scoreTotal({ certifications: 4, tropical: 4, installation: 5, price: 3, transparency: 4 })).toBe(20);
    expect(scoreTotal({ certifications: 9, price: -2 })).toBe(5);
    expect(scoreTotal({})).toBeNull();
    expect(scoreTotal(null)).toBeNull();
  });
  it('retenue > présélectionnée > candidate > écartée, puis note décroissante, repli sur la note saisie', () => {
    const r = rankSuppliers([
      { lot: 'Gazon', alias: 'Fournisseur A', status: 'candidate', scores: { certifications: 5, tropical: 5, installation: 5, price: 5, transparency: 5 } },
      { lot: 'Gazon', alias: 'Fournisseur B', status: 'rejected', scores: { certifications: 5, tropical: 5, installation: 5, price: 5, transparency: 5 } },
      { lot: 'Gazon', alias: 'Fournisseur C', status: 'shortlisted', scores: {}, score: 17 },
      { lot: 'Gazon', alias: 'Fournisseur D', status: 'shortlisted', scores: { certifications: 4, tropical: 4, installation: 4, price: 4, transparency: 4 } },
      { lot: 'Padel', alias: 'Fournisseur A', status: 'candidate', scores: {} },
    ]);
    expect(r.filter((x) => x.lot === 'Gazon').map((x) => `${x.alias}#${x.rank}:${x.score}`)).toEqual(['Fournisseur D#1:20', 'Fournisseur C#2:17', 'Fournisseur A#3:25', 'Fournisseur B#4:25']);
    expect(r.find((x) => x.lot === 'Padel')).toMatchObject({ rank: 1, score: null });
  });
});
