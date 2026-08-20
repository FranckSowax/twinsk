/**
 * § 11.2.3 — Étanchéité du partage public.
 *
 * Ce test est la garantie que la projection ne fuitera pas quand quelqu'un
 * ajoutera une colonne dans six mois : il cherche les clés et les valeurs
 * sensibles RÉCURSIVEMENT dans la sortie, sans supposer sa forme.
 */
import { describe, expect, it } from 'vitest';
import { toPublicProjection } from './publicProjection';
import { computeProject, type SupplierWithQuote } from './compute';
import { DEFAULT_PARAMS, DEFAULT_WEIGHTS } from './defaults';
import type { SourcingCondition, SourcingProject, SourcingQuote, SourcingSupplier } from './types';

/* ═══ Fixtures : volontairement chargées de données sensibles ═══ */

function supplier(over: Partial<SourcingSupplier> & { id: string; name: string }): SourcingSupplier {
  return {
    project_id: 'p1',
    ext_id: over.id,
    position: 0,
    legal_name: '揭阳市长荣实业有限公司',
    registration: 'SSM 199301028474',
    country: 'MY',
    track: 'A',
    verdict: 'amber',
    verdict_label: 'Réserves',
    strengths: 'Seul du panel à réunir les deux briques techniques.',
    weaknesses: 'Groupe parent en pertes sur trois exercices.',
    warnings: ['Domaine sosie repéré', 'Contracter avec 283212-H, pas la société sœur'],
    contacts: [
      { label: 'e-mail', value: 'contact@exemple.invalid', kind: 'email' },
      { label: 'WeChat', value: 'wx-exemple-000', kind: 'wechat' },
    ],
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
    twist_proof: 'Photos de moule + référence client',
    dfm_notes: 'Noyau dévisseur nécessaire.',
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
    payment_terms: '30 % à la commande, 70 % avant expédition',
    notes: 'Négocier l’amortissement outillage.',
    ...over,
  };
}

const ENTRIES: SupplierWithQuote[] = [
  {
    supplier: supplier({ id: 's1', name: 'Ee-Lian Enterprise', country: 'MY', track: 'A' }),
    quote: quote({ supplier_id: 's1' }),
  },
  {
    supplier: supplier({
      id: 's2',
      name: 'Picnic Plast Industrial',
      country: 'TH',
      track: 'A',
      solidity: 85,
    }),
    quote: quote({
      supplier_id: 's2',
      currency: 'USD',
      price_5k: 3.9,
      mould_plate_cost: 6500,
      mould_lid_cost: 9500,
      sets_per_carton: 40,
      carton_volume_m3: 0.052,
      carton_weight_kg: 11,
      twist_lock: 'oui_photo',
      moq: 10000,
    }),
  },
  {
    supplier: supplier({
      id: 's3',
      name: 'Changrong Plastics',
      country: 'CN',
      track: 'B',
      solidity: 55,
    }),
    quote: quote({
      supplier_id: 's3',
      currency: 'CNY',
      price_5k: 19.37,
      mould_plate_cost: 42000,
      mould_lid_cost: 78000,
      sets_per_carton: 30,
      carton_volume_m3: 0.058,
      carton_weight_kg: 12,
      twist_lock: 'etude',
      moq: 5000,
      cert_fda: false,
      cert_lfgb: false,
    }),
  },
];

const PROJECT: SourcingProject = {
  id: 'p1',
  slug: 'assiette-9-twistlock',
  title: 'Assiette 9″ 3 compartiments à couvercle twist-lock',
  client: 'Twinsk — groupe Sowax',
  buyer: 'Acheteur interne',
  status: 'active',
  spec: { rows: [{ label: 'Diamètre hors tout', value: '229 mm', tolerance: '± 2 mm' }] },
  market_finding: {
    blocks: [{ title: 'Le produit n’existe pas au catalogue', body: 'Sept requêtes…' }],
  },
  params: DEFAULT_PARAMS,
  weights: DEFAULT_WEIGHTS,
  decision: {
    question: 'Un fournisseur a-t-il démontré, preuves à l’appui, qu’il sait produire ce couvercle ?',
    options: ['Oui', 'Non'],
    answer: 'Oui — au moins un fournisseur a fourni des preuves',
    winner: 'Ee-Lian Enterprise',
    backup: 'Picnic Plast Industrial',
    date: '2026-09-01',
    rationale: 'Seule faisabilité prouvée par une référence client joignable.',
    actions: 'Commander les échantillons T1.',
  },
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-20T12:00:00Z',
};

const CONDITIONS: SourcingCondition[] = [
  {
    id: 'c1',
    project_id: 'p1',
    position: 0,
    title: 'Rapport de crédit',
    detail: null,
    state: 'oui',
    resolved_on: '2026-08-18',
    evidence: 'Rapport reçu',
  },
  {
    id: 'c2',
    project_id: 'p1',
    position: 1,
    title: 'Audit d’usine',
    detail: null,
    state: null,
    resolved_on: null,
    evidence: null,
  },
  {
    id: 'c3',
    project_id: 'p1',
    position: 2,
    title: 'Clause de propriété',
    detail: null,
    state: 'na',
    resolved_on: null,
    evidence: null,
  },
];

const project = (over: Partial<SourcingProject> = {}): SourcingProject => ({ ...PROJECT, ...over });

/* ═══ Inspection récursive ═══ */

function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectNumbers(v, out);
  } else if (typeof value === 'number') {
    out.push(value);
  }
  return out;
}

/* ═══ Le test qui compte ═══ */

describe('étanchéité de la projection publique', () => {
  const out = toPublicProjection({ project: project(), entries: ENTRIES, conditions: CONDITIONS });
  const serialized = JSON.stringify(out);
  const keys = collectKeys(out);

  it('aucune clé interdite, à aucune profondeur', () => {
    const forbidden = [
      'price_5k', 'price_10k', 'price_20k',
      'mould_plate_cost', 'mould_lid_cost', 'sample_cost',
      'contacts', 'registration', 'legal_name', 'warnings',
      'solidity', 'solid', 'strengths', 'weaknesses',
      'notes', 'dfm_notes', 'payment_terms', 'twist_proof',
      'name', 'supplier', 'quote', 'ext_id', 'id',
      'sets_per_carton', 'carton_volume_m3', 'carton_weight_kg',
      'port', 'incoterm', 'cavities', 'moq', 'known_moq',
      'params', 'weights', 'fx', 'buyer', 'slug',
      'bestCostPerSet', 'costPerSet', 'totalEur', 'landed',
      'log', 'images', 'contact_name', 'channel',
    ];
    expect(forbidden.filter((k) => keys.has(k))).toEqual([]);
  });

  it('aucune valeur monétaire absolue', () => {
    const money = [17.5, 16.2, 15.1, 3.9, 19.37, 26000, 41000, 6500, 9500, 42000, 78000, 250];
    const numbers = collectNumbers(out);
    expect(money.filter((m) => numbers.includes(m))).toEqual([]);

    // Les coûts débarqués sont recalculés depuis la fixture plutôt que codés en
    // dur : le test continue de vérifier ce qu'il prétend même si la fixture bouge.
    const computed = computeProject({
      params: DEFAULT_PARAMS,
      weights: DEFAULT_WEIGHTS,
      entries: ENTRIES,
    });
    for (const row of computed.withCost) {
      const cost = row.landed!.costPerSet;
      expect(numbers.some((n) => Math.abs(n - cost) < 0.01)).toBe(false);
      expect(numbers.some((n) => Math.abs(n - row.landed!.totalEur) < 1)).toBe(false);
    }
  });

  it('aucun nom de fournisseur ni coordonnée dans la sortie sérialisée', () => {
    for (const secret of [
      'Ee-Lian',
      'Picnic Plast',
      'Changrong',
      '揭阳市长荣实业有限公司',
      'SSM 199301028474',
      'contact@exemple.invalid',
      'wx-exemple-000',
      'Domaine sosie',
      'Mme Tan',
      '30 % à la commande',
      'Noyau dévisseur',
      'Négocier l’amortissement',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('le journal de contact et les annexes ne sont pas exposés', () => {
    expect(keys.has('log')).toBe(false);
    expect(keys.has('images')).toBe(false);
    expect(keys.has('storage_key')).toBe(false);
  });

  it('les paramètres de calcul ne sortent pas', () => {
    expect(keys.has('params')).toBe(false);
    expect(keys.has('freight_rate_eur_m3')).toBe(false);
    expect(keys.has('duty_pct')).toBe(false);
    expect(serialized).not.toContain('180');
  });
});

/* ═══ Ce que la vue partagée DOIT montrer ═══ */

describe('ce que la projection publie', () => {
  const out = toPublicProjection({ project: project(), entries: ENTRIES, conditions: CONDITIONS });

  it('titre, client et statut du projet', () => {
    expect(out.project.title).toContain('Assiette');
    expect(out.project.client).toBe('Twinsk — groupe Sowax');
    expect(out.project.status).toBe('active');
  });

  it('le cahier des charges et le constat de marché, en entier', () => {
    expect(out.spec[0]).toEqual({
      label: 'Diamètre hors tout',
      value: '229 mm',
      tolerance: '± 2 mm',
    });
    expect(out.market[0].title).toBe('Le produit n’existe pas au catalogue');
  });

  it('un classement anonymisé, par rang', () => {
    expect(out.ranking.map((r) => r.alias)).toEqual([
      'Fournisseur A',
      'Fournisseur B',
      'Fournisseur C',
    ]);
    expect(out.ranking.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(out.ranking.every((r) => r.score >= 0 && r.score <= 100)).toBe(true);
  });

  it('l’écart de coût en pourcentage, jamais en valeur', () => {
    const premiums = out.ranking.map((r) => r.costPremiumPct);
    expect(premiums.some((p) => p === 0)).toBe(true); // le moins-disant
    expect(premiums.every((p) => p == null || (p >= 0 && p < 100))).toBe(true);
  });

  it('la voie reste visible : elle éclaire la stratégie sans identifier', () => {
    expect(out.ranking.map((r) => r.track).filter(Boolean).length).toBeGreaterThan(0);
  });

  it('l’avancement des conditions, sans exposer leur contenu', () => {
    expect(out.conditions).toEqual({ total: 3, applicable: 2, lifted: 1 });
  });

  it('les indicateurs d’avancement, sans le meilleur coût', () => {
    expect(out.kpis.consulted).toBe(3);
    expect(out.kpis.responseRate).toBe(100);
    expect(out.kpis.provenTwistLock).toBe(2);
    expect(out.kpis.spreadPct).toBe(18); // écart min → max de cette fixture
    // Le meilleur coût est une valeur monétaire absolue : il ne sort jamais.
    expect('bestCostPerSet' in out.kpis).toBe(false);
  });
});

/* ═══ Règles de masquage ═══ */

describe('règles de masquage', () => {
  it('un pays représenté par un seul fournisseur est masqué', () => {
    // Chaque fournisseur du jeu est seul dans son pays (MY, TH, CN).
    const out = toPublicProjection({ project: project(), entries: ENTRIES, conditions: [] });
    expect(out.ranking.every((r) => r.country === null)).toBe(true);
  });

  it('un pays partagé par deux fournisseurs reste visible', () => {
    const entries = ENTRIES.map((e) => ({
      supplier: { ...e.supplier, country: 'CN' },
      quote: e.quote,
    }));
    const out = toPublicProjection({ project: project(), entries, conditions: [] });
    expect(out.ranking.every((r) => r.country === 'CN')).toBe(true);
  });

  it('le fournisseur retenu n’est pas nommé par défaut', () => {
    const out = toPublicProjection({ project: project(), entries: ENTRIES, conditions: [] });
    expect(out.decision?.winner).toBeNull();
    expect(JSON.stringify(out)).not.toContain('Ee-Lian');
  });

  it('il n’est nommé que si le lien a été créé avec reveal_winner', () => {
    const out = toPublicProjection({
      project: project(),
      entries: ENTRIES,
      conditions: [],
      revealWinner: true,
    });
    expect(out.decision?.winner).toBe('Ee-Lian Enterprise');
  });

  it('la motivation est publiée, les actions internes non', () => {
    const out = toPublicProjection({ project: project(), entries: ENTRIES, conditions: [] });
    expect(out.decision?.rationale).toContain('référence client joignable');
    expect(JSON.stringify(out)).not.toContain('Commander les échantillons');
  });

  it('sans décision prise, la section reste nulle', () => {
    const out = toPublicProjection({
      project: project({ decision: {} }),
      entries: ENTRIES,
      conditions: [],
    });
    expect(out.decision).toBeNull();
  });

  it('un fournisseur non noté n’apparaît pas dans le classement', () => {
    const entries: SupplierWithQuote[] = [
      ...ENTRIES,
      {
        supplier: supplier({ id: 's4', name: 'Jamais contacté' }),
        quote: {
          ...quote({ supplier_id: 's4' }),
          status: 'a_contacter',
          replied_at: null,
          twist_lock: null,
          price_5k: null,
          cert_fda: false,
          cert_lfgb: false,
        },
      },
    ];
    const out = toPublicProjection({ project: project(), entries, conditions: [] });
    expect(out.ranking).toHaveLength(3);
    expect(JSON.stringify(out)).not.toContain('Jamais contacté');
  });
});
