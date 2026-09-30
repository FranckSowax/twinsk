import { describe, expect, it } from 'vitest';
import { DOM_TOM_TEMPLATE } from './templates/dom-tom';
import { buildPlan, canAdvanceOrder, canCompleteTask, canUnvalidateLine, canValidateLine, groupByLot, initialPhases, isPhaseLocked, lineTotal, missingDailyUpdate, nextOrderStatus, previousBusinessDay, progress, quoteTotals, supplierAlias, toggleChecklist, type QuoteLineLike } from './logic';
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
    project: { title: 'PSG Academy DOM-TOM', description: 'd', currency: 'EUR', status: 'active', phases, business_trip_interested_at: null, business_trip_quote_requested_at: null },
    template: DOM_TOM_TEMPLATE,
    steps: [{ key: 's', title: 'S', description: '', position: 0 }],
    tasks: [{ id: 't1', step_key: 's', title: 'T', description: '', owner: 'client', phase: 'phase2', due_at: START, status: 'todo', checklist: [{ id: 'c', label: 'l', done: false }], attachments: [] }],
    taskComments: [{ id: 'k', task_id: 't1', author: 'team', author_name: 'Franck', text: 'ok', attachments: [], created_at: START }],
    updates: [{ id: 'u', title: 'Jour 1', body: 'b', attachments: [], published_at: START }],
    updateComments: [],
    questions: [{ id: 'q', subject: 'S', detail: 'D', attachment: null, status: 'open', created_at: START }],
    questionReplies: [],
    documents: [{ id: 'd1', category: 'site', name: 'plan.pdf', size: 10, uploaded_by: 'Client', created_at: START }],
    quoteLines: [{ id: 'l1', lot: 'Gazon', label: 'Gazon', unit: 'm²', quantity: 5800, client_quantity: null, unit_price: 12, optional: false, enabled: true, status: 'draft', phase: null, validated_at: null, supplier_id: 'sup1' }],
    orders: [],
    suppliers: [{ id: 'sup1', lot: 'Gazon', alias: 'Fournisseur A', score: 21 }],
    finalReports: [{ phase: 'phase1', checklist: [], delivered_at: null, file_id: null }],
  };
  // Simule une base qui contiendrait ces champs sensibles : ils ne doivent jamais transiter.
  const polluted = JSON.parse(JSON.stringify(raw)) as RawForPublic & Record<string, unknown>;
  (polluted.suppliers[0] as Record<string, unknown>).real_name = 'Shenzhen Turf Co';
  (polluted.suppliers[0] as Record<string, unknown>).contact = 'wechat:xxx';
  (polluted.quoteLines[0] as Record<string, unknown>).unit_cost = 7;
  (polluted as Record<string, unknown>).exchanges = [{ note: 'secret' }];
  const view = projectPublicView(polluted, 'TOKEN');
  it('champs interdits absents, alias et prix de vente présents', () => {
    const keys = deepKeys(view);
    for (const f of FORBIDDEN_PUBLIC_FIELDS) expect(keys.has(f), f).toBe(false);
    expect(JSON.stringify(view)).not.toContain('Shenzhen');
    expect(view.quote.lines[0]).toMatchObject({ supplier_alias: 'Fournisseur A', unit_price: 12, total: 69600 });
    expect(view.tasks[0].locked).toBe(true);
    expect(view.documents[0].download_path).toBe('/api/projects/public/TOKEN/documents/d1');
    expect(view.quote.totals).toEqual({ committed: 0, pending: 69600, estimated: 69600, unpriced: 0 });
  });
});
