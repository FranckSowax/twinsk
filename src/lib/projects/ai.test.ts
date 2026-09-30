import { describe, expect, it } from 'vitest';
import { planSystemPrompt, slug, updateFactsPrompt, validateExchangeSummary, validateGeneratedTemplate, validateUpdateDraft } from './ai';
import { buildPlan, isPhaseLocked } from './logic';

describe('plan depuis un brief : validation de la réponse du modèle', () => {
  const raw = {
    title: 'Boulangeries Libreville',
    description: 'Trois boulangeries.',
    phases: [{ id: 'Phase 1', name: 'Phase 1 — Libreville', sites: ['Libreville'] }, { name: 'Phase 2 — Port-Gentil', sites: ['Port-Gentil'] }],
    durations: { transit: { Libreville: [40, 55] }, production: [21, 42], technician_visa: ['x', 60] },
    steps: [
      { title: 'Étape 0 — Cadrage', description: 'd', tasks: [{ title: 'Valider le périmètre', owner: 'client', due_weeks: 1, checklist: ['a', 'b'], phase: 'phase-2' }, { title: '', owner: 'team' }] },
      { title: 'Étape 1 — RFQ', tasks: [{ title: 'RFQ fours', owner: 'nimporte', due_weeks: '3' }] },
      { title: 'Vide', tasks: [] },
    ],
    quote_lines: [{ lot: 'Fours', label: 'Four à sole 3 étages', unit: 'pièce', quantity: 3, optional: 'oui' }, { label: '' }, { lot: 'Options', label: 'Enseigne', quantity: 3, optional: true }],
    lots: ['Fours'],
  };
  const t = validateGeneratedTemplate(raw, { currency: 'XAF', title: 'Projet' })!;
  it('phases identifiées, tâches vides écartées, owner et due_weeks ramenés à des valeurs sûres', () => {
    expect(t.phases.map((p) => p.id)).toEqual(['phase-1', 'phase2']);
    expect(t.steps).toHaveLength(2);
    expect(t.steps[0].tasks).toHaveLength(1);
    expect(t.steps[0].tasks[0]).toMatchObject({ owner: 'client', due_weeks: 1, phase: 'phase2', checklist: ['a', 'b'] }); // « phase-2 » rattaché à l’id réel
    expect(t.steps[1].tasks[0]).toMatchObject({ owner: 'team', due_weeks: 3 });
    expect(t.durations.technician_visa).toEqual([28, 60]);
    expect(t.currency).toBe('XAF');
  });
  it('lignes de devis sans prix, options, lots déduits ; plan exploitable par buildPlan', () => {
    expect(t.quote_lines).toHaveLength(2);
    expect(t.quote_lines[0]).toMatchObject({ lot: 'Fours', quantity: 3, unit_price: null, optional: false });
    expect(t.quote_lines[1].optional).toBe(true);
    expect(t.lots).toEqual(['Fours', 'Options']);
    const plan = buildPlan(t, '2026-10-01T00:00:00Z');
    expect(plan.tasks).toHaveLength(2);
    expect(isPhaseLocked(t.phases.map((p) => ({ ...p, received_at: null })), 'phase2')).toBe(true);
  });
  it('réponse inutilisable → null ; prompt avec la devise', () => {
    expect(validateGeneratedTemplate({ steps: [] }, { currency: 'EUR', title: 'P' })).toBeNull();
    expect(validateGeneratedTemplate('rien', { currency: 'EUR', title: 'P' })).toBeNull();
    expect(planSystemPrompt('EUR')).toContain('devise EUR');
    expect(slug('Étape 1 — Consultation')).toBe('etape-1-consultation');
  });
});

describe('résumé d’échange et brouillon de journal', () => {
  it('résumé validé, canal ramené à la liste, chiffres gardés', () => {
    const r = validateExchangeSummary({ summary: 'L’usine confirme 12 $ / m² FOB, MOQ 2 000 m².', next_action: 'Demander la fiche technique', next_action_days: '3', channel: 'WeChat', key_figures: ['12 $/m² FOB', 'MOQ 2 000 m²'] })!;
    expect(r).toMatchObject({ next_action_days: 3, channel: 'wechat', key_figures: ['12 $/m² FOB', 'MOQ 2 000 m²'] });
    expect(validateExchangeSummary({ summary: '' })).toBeNull();
  });
  it('faits du journal listés sans dialogue brut, brouillon validé', () => {
    const p = updateFactsPrompt({ projectTitle: 'P', since: '29/09/2026', tasksDone: ['RFQ gazon'], tasksDue: [], orders: ['CMD-001 : Production'], questionsAnswered: [], questionsOpen: ['Délai ?'], documents: [], exchanges: ['Usine X : prix confirmé'], progressPct: 40 });
    expect(p).toContain('Tâches terminées :\n- RFQ gazon');
    expect(p).toContain('Tâches à échéance dans les 7 jours : aucun');
    expect(validateUpdateDraft({ title: 'Point du jour', body: 'Texte' })).toEqual({ title: 'Point du jour', body: 'Texte' });
    expect(validateUpdateDraft({ title: 'x' })).toBeNull();
  });
});
