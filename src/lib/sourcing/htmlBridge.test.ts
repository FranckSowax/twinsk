/**
 * Aller-retour avec le cockpit autonome (§ 11.1).
 *
 * Le fichier d'origine sérialise des champs de formulaire, pas un modèle métier :
 * ces tests fixent la correspondance dans les deux sens et vérifient qu'un export
 * réimporté rend les mêmes valeurs.
 */
import { describe, expect, it } from 'vitest';
import { fromCockpitFile, toCockpitFile, type CockpitFile } from './htmlBridge';
import { DEFAULT_PARAMS, DEFAULT_WEIGHTS, SPEC_ROWS } from './defaults';
import type {
  SourcingCondition,
  SourcingContactLogEntry,
  SourcingProject,
  SourcingQuote,
  SourcingSupplier,
} from './types';

/* ═══ Fixtures ═══ */

function supplier(over: Partial<SourcingSupplier> & { id: string; name: string }): SourcingSupplier {
  return {
    project_id: 'p1',
    ext_id: over.id,
    position: 0,
    legal_name: null,
    registration: null,
    country: 'MY',
    track: 'A',
    verdict: 'amber',
    verdict_label: 'Réserves',
    strengths: null,
    weaknesses: null,
    warnings: [],
    contacts: [],
    default_currency: 'MYR',
    known_moq: 3000,
    solidity: 45,
    included: true,
    ...over,
  };
}

function quote(over: Partial<SourcingQuote> & { supplier_id: string }): SourcingQuote {
  return {
    status: 'a_repondu',
    contact_name: 'Mme Tan',
    channel: 'e-mail',
    sent_at: '2026-08-01',
    replied_at: '2026-08-10',
    twist_lock: 'oui_ref',
    twist_proof: 'Photos de moule',
    dfm_notes: 'Noyau dévisseur.',
    currency: 'MYR',
    price_5k: 17.5,
    price_10k: 16.2,
    price_20k: 15.1,
    moq: 3000,
    mould_plate_cost: 26000,
    mould_lid_cost: 41000,
    cavities: '4+4',
    mould_life_cycles: 500000,
    mould_ownership: 'acheteur',
    sample_cost: 250,
    sample_days: 18,
    tooling_days: 50,
    production_days: 30,
    sets_per_carton: 36,
    carton_volume_m3: 0.049,
    carton_weight_kg: 10.2,
    port: 'Penang',
    incoterm: 'FOB',
    cert_fda: true,
    cert_lfgb: true,
    cert_iso: false,
    cert_migration: false,
    payment_terms: '30 % à la commande',
    notes: 'À relancer.',
    ...over,
  };
}

const PROJECT: SourcingProject = {
  id: 'p1',
  slug: 'assiette-9-twistlock',
  title: 'Assiette 9″ 3 compartiments à couvercle twist-lock',
  client: 'Twinsk — groupe Sowax',
  buyer: 'Acheteur interne',
  status: 'active',
  spec: {
    rows: SPEC_ROWS.map((label, i) => ({
      label,
      value: i === 0 ? '229 mm' : '',
      tolerance: i === 0 ? '± 2 mm' : '',
    })),
  },
  market_finding: { blocks: [] },
  params: DEFAULT_PARAMS,
  weights: DEFAULT_WEIGHTS,
  decision: {
    answer: 'Oui — au moins un fournisseur a fourni des preuves',
    winner: 'Ee-Lian',
    backup: 'Picnic Plast',
    date: '2026-09-01',
    rationale: 'Faisabilité prouvée.',
    actions: 'Commander les échantillons T1.',
  },
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-20T12:00:00Z',
};

const SUPPLIERS = [
  { supplier: supplier({ id: 'eelian', name: 'Ee-Lian' }), quote: quote({ supplier_id: 'eelian' }) },
  {
    supplier: supplier({ id: 'picnic', name: 'Picnic Plast', solidity: 85, included: false }),
    quote: quote({ supplier_id: 'picnic', status: 'a_refuse', currency: 'USD', price_5k: 3.9 }),
  },
];

const CONDITIONS: SourcingCondition[] = [
  {
    id: 'c1',
    project_id: 'p1',
    position: 0,
    title: 'Rapport de crédit',
    detail: null,
    state: 'oui',
    resolved_on: '2026-08-18',
    evidence: 'Reçu',
  },
  {
    id: 'c2',
    project_id: 'p1',
    position: 1,
    title: 'Audit',
    detail: null,
    state: null,
    resolved_on: null,
    evidence: null,
  },
  {
    id: 'c3',
    project_id: 'p1',
    position: 2,
    title: 'Propriété du moule',
    detail: null,
    state: 'na',
    resolved_on: null,
    evidence: null,
  },
];

const LOG: SourcingContactLogEntry[] = [
  {
    id: 'l1',
    project_id: 'p1',
    supplier_id: 'eelian',
    happened_on: '2026-08-14',
    channel: 'e-mail',
    contact_name: 'Mme Tan',
    subject: 'Relance colisage',
    outcome: 'Volume carton reçu',
  },
];

const exported = () =>
  toCockpitFile({ project: PROJECT, suppliers: SUPPLIERS, conditions: CONDITIONS, log: LOG });

/* ═══ Export ═══ */

describe('export vers le format du cockpit', () => {
  const file = exported();

  it('les métadonnées et le cahier des charges sont placés sous leurs clés', () => {
    expect(file.fields['meta.projet']).toContain('Assiette');
    expect(file.fields['meta.client']).toBe('Twinsk — groupe Sowax');
    expect(file.fields['cdc.diam']).toBe('229 mm');
    expect(file.fields['cdc.diamTol']).toBe('± 2 mm');
  });

  it('les paramètres et pondérations reprennent les identifiants du cockpit', () => {
    expect(file.fields['#p_qty']).toBe('5000');
    expect(file.fields['#p_freight']).toBe('180');
    expect(file.fields['#p_ins']).toBe('0.4');
    expect(file.fields['#w_twist']).toBe('30');
    expect(file.fields['#fx_MYR']).toBe('0.2');
  });

  it('l’euro n’a pas de champ : le cockpit le tient pour 1', () => {
    expect('#fx_EUR' in file.fields).toBe(false);
  });

  it('le statut part en libellé français, pas en clé', () => {
    expect(file.sup.eelian.statut).toBe('A répondu');
    expect(file.sup.picnic.statut).toBe('A refusé');
  });

  it('l’inclusion au panel devient 1 ou 0', () => {
    expect(file.sup.eelian.incl).toBe('1');
    expect(file.sup.picnic.incl).toBe('0');
  });

  it('les certificats partent en booléens, les chiffres en chaînes', () => {
    expect(file.sup.eelian.cFDA).toBe(true);
    expect(file.sup.eelian.cISO).toBe(false);
    expect(file.sup.eelian.p5).toBe('17.5');
    expect(file.sup.eelian.mA).toBe('26000');
  });

  it('les conditions sont indexées par position, avec leur libellé', () => {
    expect(file.fields['cond.0.ok']).toBe('Oui');
    expect(file.fields['cond.0.date']).toBe('2026-08-18');
    expect(file.fields['cond.1.ok']).toBe(''); // non statué
    expect(file.fields['cond.2.ok']).toBe('N/A');
  });

  it('le journal référence le fournisseur par son identifiant court', () => {
    expect(file.log[0]).toEqual({
      d: '2026-08-14',
      f: 'eelian',
      c: 'e-mail',
      i: 'Mme Tan',
      o: 'Relance colisage — Volume carton reçu',
    });
  });

  it('un fournisseur sans ext_id est omis plutôt que placé sous une clé inventée', () => {
    const file2 = toCockpitFile({
      project: PROJECT,
      suppliers: [
        { supplier: supplier({ id: 'x', name: 'Sans identifiant', ext_id: null }), quote: null },
      ],
      conditions: [],
      log: [],
    });
    expect(Object.keys(file2.sup)).toEqual([]);
  });
});

/* ═══ Import ═══ */

describe('import depuis le format du cockpit', () => {
  it('rend les valeurs chiffrées en nombres, virgule décimale comprise', () => {
    const r = fromCockpitFile({
      fields: {},
      sup: { eelian: { p5: '17,5', volCart: '0,049', setsCart: '36' } },
      log: [],
    });
    expect(r.suppliers.eelian.quote.price_5k).toBe(17.5);
    expect(r.suppliers.eelian.quote.carton_volume_m3).toBe(0.049);
    expect(r.suppliers.eelian.quote.sets_per_carton).toBe(36);
  });

  it('un champ chiffré vide devient null, jamais zéro', () => {
    const r = fromCockpitFile({
      fields: {},
      sup: { eelian: { p5: '', mA: '', setsCart: '' } },
      log: [],
    });
    expect(r.suppliers.eelian.quote.price_5k).toBeNull();
    expect(r.suppliers.eelian.quote.mould_plate_cost).toBeNull();
    expect(r.suppliers.eelian.quote.sets_per_carton).toBeNull();
  });

  it('le libellé de statut retrouve sa clé', () => {
    const r = fromCockpitFile({ fields: {}, sup: { a: { statut: 'A répondu' } }, log: [] });
    expect(r.suppliers.a.quote.status).toBe('a_repondu');
  });

  it('un statut inconnu est ignoré plutôt que deviné', () => {
    const r = fromCockpitFile({ fields: {}, sup: { a: { statut: 'Peut-être' } }, log: [] });
    expect('status' in r.suppliers.a.quote).toBe(false);
  });

  it('la faisabilité vide devient null, une valeur hors barème aussi', () => {
    const vide = fromCockpitFile({ fields: {}, sup: { a: { twist: '' } }, log: [] });
    expect(vide.suppliers.a.quote.twist_lock).toBeNull();
    const faux = fromCockpitFile({ fields: {}, sup: { a: { twist: 'peut-etre' } }, log: [] });
    expect(faux.suppliers.a.quote.twist_lock).toBeNull();
  });

  it('l’inclusion se relit depuis 1 / 0', () => {
    const oui = fromCockpitFile({ fields: {}, sup: { a: { incl: '1' } }, log: [] });
    const non = fromCockpitFile({ fields: {}, sup: { a: { incl: '0' } }, log: [] });
    expect(oui.suppliers.a.supplier.included).toBe(true);
    expect(non.suppliers.a.supplier.included).toBe(false);
  });

  it('les états de condition retrouvent leurs clés', () => {
    const r = fromCockpitFile({
      fields: { 'cond.0.ok': 'Oui', 'cond.1.ok': 'Non', 'cond.2.ok': 'N/A', 'cond.3.ok': '' },
      sup: {},
      log: [],
    });
    expect(r.conditions.map((c) => c.patch.state)).toEqual(['oui', 'non', 'na', null]);
  });

  it('l’euro est rétabli à 1 quand des taux sont présents', () => {
    const r = fromCockpitFile({ fields: { '#fx_MYR': '0.2' }, sup: {}, log: [] });
    expect(r.project.params?.fx).toEqual({ EUR: 1, MYR: 0.2 });
  });

  it('un fichier vide ne produit aucun patch', () => {
    const r = fromCockpitFile({});
    expect(r.project).toEqual({});
    expect(r.suppliers).toEqual({});
    expect(r.conditions).toEqual([]);
    expect(r.log).toEqual([]);
  });

  it('un fichier illisible ne fait pas tomber le pont', () => {
    expect(() => fromCockpitFile(null)).not.toThrow();
    expect(() => fromCockpitFile('nawak')).not.toThrow();
    expect(() => fromCockpitFile({ fields: null, sup: 42, log: 'x' })).not.toThrow();
  });
});

/* ═══ Aller-retour ═══ */

describe('aller-retour export → import', () => {
  const file = exported();
  const back = fromCockpitFile(file as unknown as CockpitFile);

  it('les valeurs du projet reviennent identiques', () => {
    expect(back.project.title).toBe(PROJECT.title);
    expect(back.project.client).toBe(PROJECT.client);
    expect(back.project.buyer).toBe(PROJECT.buyer);
  });

  it('le cahier des charges revient sur les mêmes lignes', () => {
    const rows = (back.project.spec as { rows: Array<{ label: string; value: string }> }).rows;
    expect(rows[0]).toEqual({ label: SPEC_ROWS[0], value: '229 mm', tolerance: '± 2 mm' });
    expect(rows).toHaveLength(SPEC_ROWS.length);
  });

  it('les paramètres et pondérations reviennent au nombre près', () => {
    expect(back.project.params?.qty).toBe(DEFAULT_PARAMS.qty);
    expect(back.project.params?.insurance_pct).toBe(DEFAULT_PARAMS.insurance_pct);
    expect(back.project.params?.fx).toEqual(DEFAULT_PARAMS.fx);
    expect(back.project.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('la décision revient entière', () => {
    expect(back.project.decision).toEqual(PROJECT.decision);
  });

  it('les réponses fournisseur reviennent au nombre près', () => {
    const q = back.suppliers.eelian.quote;
    const source = SUPPLIERS[0].quote;
    expect(q.price_5k).toBe(source.price_5k);
    expect(q.mould_plate_cost).toBe(source.mould_plate_cost);
    expect(q.carton_volume_m3).toBe(source.carton_volume_m3);
    expect(q.status).toBe(source.status);
    expect(q.twist_lock).toBe(source.twist_lock);
    expect(q.mould_ownership).toBe(source.mould_ownership);
    expect(q.cert_fda).toBe(true);
    expect(q.cert_iso).toBe(false);
    expect(q.replied_at).toBe(source.replied_at);
  });

  it('la solidité et l’inclusion reviennent sur le fournisseur', () => {
    expect(back.suppliers.eelian.supplier.solidity).toBe(45);
    expect(back.suppliers.eelian.supplier.included).toBe(true);
    expect(back.suppliers.picnic.supplier.included).toBe(false);
  });

  it('les conditions reviennent dans l’ordre, avec leur état', () => {
    expect(back.conditions.map((c) => c.position)).toEqual([0, 1, 2]);
    expect(back.conditions[0].patch.state).toBe('oui');
    expect(back.conditions[0].patch.resolved_on).toBe('2026-08-18');
    expect(back.conditions[1].patch.state).toBeNull();
    expect(back.conditions[2].patch.state).toBe('na');
  });

  it('le journal revient rattaché au bon fournisseur', () => {
    expect(back.log).toHaveLength(1);
    expect(back.log[0].supplierExtId).toBe('eelian');
    expect(back.log[0].happened_on).toBe('2026-08-14');
  });

  it('un second export ne dérive pas du premier', () => {
    expect(
      toCockpitFile({
        project: PROJECT,
        suppliers: SUPPLIERS,
        conditions: CONDITIONS,
        log: LOG,
      }),
    ).toEqual(file);
  });
});
