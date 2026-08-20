import { describe, it, expect } from 'vitest';
import {
  computeLandedCost,
  computeProject,
  confScore,
  fxRate,
  moqScore,
  normalizeInverse,
  num,
  twistScore,
} from './compute';
import { DEFAULT_PARAMS, DEFAULT_WEIGHTS } from './defaults';
import type { SourcingQuote, SourcingSupplier } from './types';

/* ═══ Fabriques ═══ */

function makeSupplier(over: Partial<SourcingSupplier> & { id: string; name: string }): SourcingSupplier {
  return {
    project_id: 'p1',
    ext_id: over.id,
    position: 0,
    legal_name: null,
    registration: null,
    country: null,
    track: null,
    verdict: null,
    verdict_label: null,
    strengths: null,
    weaknesses: null,
    warnings: [],
    contacts: [],
    default_currency: null,
    known_moq: null,
    solidity: null,
    included: true,
    ...over,
  };
}

/** Devis vierge : tous les champs chiffrés à null, jamais à zéro. */
function makeQuote(over: Partial<SourcingQuote> & { supplier_id: string }): SourcingQuote {
  return {
    status: 'a_contacter',
    contact_name: null,
    channel: null,
    sent_at: null,
    replied_at: null,
    twist_lock: null,
    twist_proof: null,
    dfm_notes: null,
    currency: null,
    price_5k: null,
    price_10k: null,
    price_20k: null,
    moq: null,
    mould_plate_cost: null,
    mould_lid_cost: null,
    cavities: null,
    mould_life_cycles: null,
    mould_ownership: null,
    sample_cost: null,
    sample_days: null,
    tooling_days: null,
    production_days: null,
    sets_per_carton: null,
    carton_volume_m3: null,
    carton_weight_kg: null,
    port: null,
    incoterm: null,
    cert_fda: false,
    cert_lfgb: false,
    cert_iso: false,
    cert_migration: false,
    payment_terms: null,
    notes: null,
    ...over,
  };
}

/* ═══ Jeu d'essai § 11.2.1 — vérifié dans le cockpit HTML, paramètres par défaut ═══ */

const FIXTURE = [
  {
    supplier: makeSupplier({ id: 'changrong', name: 'Changrong', track: 'B', solidity: 55 }),
    quote: makeQuote({
      supplier_id: 'changrong',
      status: 'a_repondu',
      replied_at: '2026-08-10',
      currency: 'CNY',
      price_5k: 19,
      mould_plate_cost: 42000,
      mould_lid_cost: 78000,
      sets_per_carton: 30,
      carton_volume_m3: 0.058,
      carton_weight_kg: 12,
      twist_lock: 'etude',
      moq: 5000,
      tooling_days: 40,
      production_days: 28,
      sample_days: 15,
    }),
  },
  {
    supplier: makeSupplier({ id: 'eelian', name: 'Ee-Lian', track: 'A', solidity: 45 }),
    quote: makeQuote({
      supplier_id: 'eelian',
      status: 'a_repondu',
      replied_at: '2026-08-10',
      currency: 'MYR',
      price_5k: 17.5,
      mould_plate_cost: 26000,
      mould_lid_cost: 41000,
      sets_per_carton: 36,
      carton_volume_m3: 0.049,
      carton_weight_kg: 10.2,
      twist_lock: 'oui_ref',
      moq: 3000,
      tooling_days: 50,
      production_days: 30,
      sample_days: 18,
      cert_fda: true,
      cert_lfgb: true,
    }),
  },
  {
    supplier: makeSupplier({ id: 'picnic', name: 'Picnic Plast', track: 'A', solidity: 85 }),
    quote: makeQuote({
      supplier_id: 'picnic',
      status: 'a_repondu',
      replied_at: '2026-08-10',
      currency: 'USD',
      price_5k: 3.9,
      mould_plate_cost: 6500,
      mould_lid_cost: 9500,
      sets_per_carton: 40,
      carton_volume_m3: 0.052,
      carton_weight_kg: 11,
      twist_lock: 'oui_photo',
      moq: 10000,
      tooling_days: 45,
      production_days: 35,
      sample_days: 20,
      cert_fda: true,
      cert_iso: true,
      cert_migration: true,
    }),
  },
];

function run(entries = FIXTURE) {
  return computeProject({ params: DEFAULT_PARAMS, weights: DEFAULT_WEIGHTS, entries });
}

const byId = (r: ReturnType<typeof run>, id: string) =>
  r.rows.find((x) => x.supplier.id === id)!;

/* ═══ § 11.2.1 — Parité de calcul avec le cockpit HTML ═══ */

describe('parité du coût débarqué', () => {
  const res = run();

  it.each([
    ['changrong', 7.03],
    ['eelian', 8.0],
    ['picnic', 8.38],
  ])('%s → %s €/set', (id, expected) => {
    expect(byId(res, id).landed!.costPerSet).toBeCloseTo(expected, 2);
  });

  it('écart min → max = +19 %', () => {
    expect(Math.round(res.kpis.spreadPct!)).toBe(19);
  });

  it('le moins cher est Changrong', () => {
    expect(res.withCost[0].supplier.id).toBe('changrong');
    expect(res.kpis.bestCostPerSet).toBeCloseTo(7.03, 2);
  });

  it('décomposition cohérente : marchandise + logistique + outillage amorti = coût par set', () => {
    for (const r of res.withCost) {
      const l = r.landed!;
      expect(l.pricePerSetEur + l.logisticsPerSet + l.amortPerSet).toBeCloseTo(l.costPerSet, 6);
    }
  });

  it('le fret LCL est facturé au plus élevé du volume ou du poids en tonnes', () => {
    const l = byId(res, 'changrong').landed!;
    expect(l.cartons).toBe(Math.ceil(5000 / 30));
    expect(l.taxableUnits).toBe(Math.max(l.volumeM3, l.weightKg! / 1000));
  });
});

/* ═══ § 11.2.1 — Le test le plus important : la pondération ═══ */

describe('parité du score pondéré', () => {
  const res = run();

  it('classement Ee-Lian 62 · Picnic Plast 58 · Changrong 52', () => {
    expect(
      res.ranked.map((r) => [r.supplier.id, Math.round(r.score!), r.rank]),
    ).toEqual([
      ['eelian', 62, 1],
      ['picnic', 58, 2],
      ['changrong', 52, 3],
    ]);
  });

  it('Changrong est le moins cher et pourtant troisième', () => {
    const c = byId(res, 'changrong');
    // Il obtient bien 100 sur le coût, le MOQ et le délai…
    expect(c.nCost).toBe(100);
    expect(c.nMoq).toBe(100);
    expect(c.nLead).toBe(100);
    // …mais sa faisabilité twist-lock n'est qu'« à étudier » et il n'a produit
    // aucun certificat. Ces deux critères pèsent 50 des 100 points.
    expect(c.twist).toBe(30);
    expect(c.conf).toBe(0);
    expect(c.rank).toBe(3);
    expect(res.withCost[0].supplier.id).toBe('changrong');
  });

  it('notes de critère conformes au barème', () => {
    expect(byId(res, 'eelian').conf).toBe(50); // FDA + LFGB
    expect(byId(res, 'picnic').conf).toBe(75); // FDA + ISO + migration
    expect(byId(res, 'eelian').twist).toBe(100); // photos + référence client
    expect(byId(res, 'picnic').twist).toBe(80); // photos de moule
    expect(byId(res, 'picnic').nMoq).toBe(60); // 10 000 ≤ 2 × 5 000
  });

  it('tous les critères sont couverts sur ce jeu : covered = 100', () => {
    for (const r of res.ranked) expect(r.covered).toBe(100);
  });
});

/* ═══ § 11.2.2 — Règle de non-notation ═══ */

describe('un fournisseur sans données n’est pas noté', () => {
  const entries = [
    ...FIXTURE,
    {
      supplier: makeSupplier({ id: 'jiangsu', name: 'Jiangsu', solidity: 40 }),
      quote: makeQuote({ supplier_id: 'jiangsu' }), // statut « à contacter », rien d'autre
    },
  ];
  const res = computeProject({ params: DEFAULT_PARAMS, weights: DEFAULT_WEIGHTS, entries });
  const j = byId(res, 'jiangsu');

  it('ni score ni rang', () => {
    expect(j.scorable).toBe(false);
    expect(j.score).toBeNull();
    expect(j.rank).toBeNull();
    expect(j.pending).toBe('en attente de réponse');
  });

  it('absent du classement et de la grille de prix', () => {
    expect(res.ranked.map((r) => r.supplier.id)).not.toContain('jiangsu');
    expect(res.withCost.map((r) => r.supplier.id)).not.toContain('jiangsu');
  });

  it('ne déplace pas le classement des autres', () => {
    expect(res.ranked.map((r) => r.supplier.id)).toEqual(['eelian', 'picnic', 'changrong']);
  });

  it('un fournisseur qui a refusé est écarté de la notation, avec son motif', () => {
    const refus = computeProject({
      params: DEFAULT_PARAMS,
      weights: DEFAULT_WEIGHTS,
      entries: [
        {
          supplier: makeSupplier({ id: 'x', name: 'X', solidity: 90 }),
          // Il a répondu et fourni des certificats : sans la règle, il serait noté.
          quote: makeQuote({
            supplier_id: 'x',
            status: 'a_refuse',
            replied_at: '2026-08-01',
            cert_fda: true,
          }),
        },
      ],
    });
    expect(byId(refus, 'x').score).toBeNull();
    expect(byId(refus, 'x').pending).toBe('a refusé');
  });

  it('un fournisseur exclu du panel ne fausse pas la normalisation du coût', () => {
    const horsPanel = computeProject({
      params: DEFAULT_PARAMS,
      weights: DEFAULT_WEIGHTS,
      entries: [
        ...FIXTURE,
        {
          supplier: makeSupplier({ id: 'cher', name: 'Très cher', included: false, solidity: 10 }),
          quote: makeQuote({
            supplier_id: 'cher',
            status: 'a_repondu',
            replied_at: '2026-08-01',
            currency: 'EUR',
            price_5k: 90,
            sets_per_carton: 10,
            carton_volume_m3: 0.1,
          }),
        },
      ],
    });
    // Les notes de coût des trois autres restent celles du jeu de référence.
    expect(byId(horsPanel, 'changrong').nCost).toBe(100);
    expect(byId(horsPanel, 'picnic').nCost).toBe(0);
  });
});

/* ═══ § 11.2.5 — Nullité ═══ */

describe('l’absence de donnée n’est jamais un zéro', () => {
  const vide = makeQuote({ supplier_id: 's' });

  it('un devis vierge a tous ses champs chiffrés à null', () => {
    const chiffres = [
      'price_5k', 'price_10k', 'price_20k', 'moq', 'mould_plate_cost', 'mould_lid_cost',
      'mould_life_cycles', 'sample_cost', 'sample_days', 'tooling_days', 'production_days',
      'sets_per_carton', 'carton_volume_m3', 'carton_weight_kg',
    ] as const;
    for (const k of chiffres) expect(vide[k]).toBeNull();
  });

  it('aucun coût débarqué sans prix, sets par carton et volume', () => {
    expect(computeLandedCost(vide, 1, DEFAULT_PARAMS)).toBeNull();
    // Prix seul : insuffisant, on n'estime pas le colisage.
    expect(
      computeLandedCost({ ...vide, price_5k: 10 }, 1, DEFAULT_PARAMS),
    ).toBeNull();
    // Sets par carton à zéro : division impossible, la ligne reste hors grille.
    expect(
      computeLandedCost(
        { ...vide, price_5k: 10, sets_per_carton: 0, carton_volume_m3: 0.05 },
        1,
        DEFAULT_PARAMS,
      ),
    ).toBeNull();
  });

  it('un volume de carton à zéro est une mesure et reste accepté', () => {
    const l = computeLandedCost(
      { ...vide, price_5k: 10, sets_per_carton: 50, carton_volume_m3: 0 },
      1,
      DEFAULT_PARAMS,
    );
    expect(l).not.toBeNull();
    expect(l!.volumeM3).toBe(0);
  });

  it('un outillage non communiqué vaut null, pas zéro', () => {
    const l = computeLandedCost(
      { ...vide, price_5k: 10, sets_per_carton: 50, carton_volume_m3: 0.05 },
      1,
      DEFAULT_PARAMS,
    )!;
    expect(l.toolingEur).toBeNull();
    expect(l.amortPerSet).toBe(0); // amorti nul, mais l'outillage reste « — » à l'écran
  });

  it('un délai non communiqué vaut null, pas zéro', () => {
    const res = computeProject({
      params: DEFAULT_PARAMS,
      weights: DEFAULT_WEIGHTS,
      entries: [
        {
          supplier: makeSupplier({ id: 's', name: 'S', solidity: 50 }),
          quote: makeQuote({ supplier_id: 's', status: 'a_repondu', replied_at: '2026-08-01' }),
        },
      ],
    });
    expect(byId(res, 's').leadDays).toBeNull();
    expect(byId(res, 's').nLead).toBeNull();
  });

  it('le score se renormalise sur les seuls critères renseignés', () => {
    const res = computeProject({
      params: DEFAULT_PARAMS,
      weights: DEFAULT_WEIGHTS,
      entries: [
        {
          supplier: makeSupplier({ id: 's', name: 'S', solidity: 60 }),
          // twist (30) + conf (20) + solidité (15) renseignés ; coût, MOQ et délai absents.
          quote: makeQuote({
            supplier_id: 's',
            status: 'a_repondu',
            replied_at: '2026-08-01',
            twist_lock: 'oui_photo',
            cert_fda: true,
          }),
        },
      ],
    });
    const s = byId(res, 's');
    expect(s.covered).toBe(65);
    // (80×30 + 25×20 + 60×15) / 65
    expect(s.score).toBeCloseTo((80 * 30 + 25 * 20 + 60 * 15) / 65, 10);
  });
});

/* ═══ Helpers ═══ */

describe('helpers', () => {
  it('num accepte la virgule décimale et rejette le reste', () => {
    expect(num('17,5')).toBe(17.5);
    expect(num('3.9')).toBe(3.9);
    expect(num('')).toBeNull();
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num('abc')).toBeNull();
    expect(num(0)).toBe(0);
  });

  it('twistScore suit le barème, non répondu = 0', () => {
    expect(twistScore(null)).toBe(0);
    expect(twistScore('refus')).toBe(0);
    expect(twistScore('etude')).toBe(30);
    expect(twistScore('oui_decl')).toBe(55);
    expect(twistScore('oui_photo')).toBe(80);
    expect(twistScore('oui_ref')).toBe(100);
  });

  it('confScore compte 25 points par certificat reçu', () => {
    expect(confScore(null)).toBe(0);
    expect(
      confScore({ cert_fda: true, cert_lfgb: true, cert_iso: true, cert_migration: true }),
    ).toBe(100);
    expect(
      confScore({ cert_fda: true, cert_lfgb: false, cert_iso: false, cert_migration: false }),
    ).toBe(25);
  });

  it('moqScore : paliers, et null si non renseigné', () => {
    expect(moqScore(null, 5000)).toBeNull();
    expect(moqScore(5000, 5000)).toBe(100);
    expect(moqScore(10000, 5000)).toBe(60);
    expect(moqScore(20000, 5000)).toBe(25);
    expect(moqScore(20001, 5000)).toBe(0);
  });

  it('normalizeInverse : le plus petit vaut 100, un seul répondant vaut 100', () => {
    expect(normalizeInverse(10, [10, 20])).toBe(100);
    expect(normalizeInverse(20, [10, 20])).toBe(0);
    expect(normalizeInverse(15, [10, 20])).toBe(50);
    expect(normalizeInverse(7, [7])).toBe(100);
    expect(normalizeInverse(null, [10, 20])).toBeNull();
    expect(normalizeInverse(10, [])).toBeNull();
  });

  it('fxRate : devise absente ou inconnue → 0', () => {
    expect(fxRate(DEFAULT_PARAMS, 'MYR')).toBe(0.2);
    expect(fxRate(DEFAULT_PARAMS, null)).toBe(0);
    expect(fxRate(DEFAULT_PARAMS, 'XXX')).toBe(0);
  });
});

/* ═══ Indicateurs § 6.5 ═══ */

describe('indicateurs du tableau de bord', () => {
  const res = run();

  it('consultés, taux de réponse, faisabilité prouvée', () => {
    expect(res.kpis.activeCount).toBe(3);
    expect(res.kpis.consulted).toBe(3);
    expect(res.kpis.replied).toBe(3);
    expect(res.kpis.responseRate).toBe(100);
    // Seuls Ee-Lian (100) et Picnic (80) atteignent le seuil de preuve ; « à étudier » non.
    expect(res.kpis.provenTwistLock).toBe(2);
    expect(res.kpis.quotedCount).toBe(3);
  });

  it('taux de réponse à 0 quand personne n’a été consulté', () => {
    const vierge = computeProject({
      params: DEFAULT_PARAMS,
      weights: DEFAULT_WEIGHTS,
      entries: [
        {
          supplier: makeSupplier({ id: 'a', name: 'A' }),
          quote: makeQuote({ supplier_id: 'a' }),
        },
      ],
    });
    expect(vierge.kpis.consulted).toBe(0);
    expect(vierge.kpis.responseRate).toBe(0);
    expect(vierge.kpis.spreadPct).toBeNull();
    expect(vierge.kpis.bestCostPerSet).toBeNull();
  });

  it('l’écart est nul tant qu’il n’y a qu’une seule offre chiffrée', () => {
    const une = computeProject({
      params: DEFAULT_PARAMS,
      weights: DEFAULT_WEIGHTS,
      entries: [FIXTURE[0]],
    });
    expect(une.kpis.spreadPct).toBeNull();
    expect(une.kpis.bestCostPerSet).toBeCloseTo(7.03, 2);
  });
});
