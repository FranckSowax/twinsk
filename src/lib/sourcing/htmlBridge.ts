/**
 * Pont entre le modèle relationnel et le JSON du cockpit autonome
 * (sourcing/cockpit_sourcing_assiette.html).
 *
 * Le fichier d'origine n'exporte pas un modèle métier : il sérialise ses champs
 * de formulaire, indexés par attribut DOM. D'où cet adaptateur explicite, et
 * deux conséquences à connaître :
 *
 *  - l'export ne contient PAS l'identité des fournisseurs (le tableau SUP est en
 *    dur dans le HTML). Un import ne peut donc que mettre à jour des fournisseurs
 *    déjà présents, appariés par ext_id ; il n'en crée aucun.
 *  - le fichier ne transporte AUCUNE image : le cockpit n'en gère pas.
 */

import { num } from './compute';
import { QUOTE_STATUS_LABELS, SPEC_ROWS } from './defaults';
import type {
  ConditionState,
  MouldOwnership,
  QuoteStatus,
  SourcingCondition,
  SourcingContactLogEntry,
  SourcingParams,
  SourcingProject,
  SourcingQuote,
  SourcingSupplier,
  SourcingWeights,
  TwistLock,
} from './types';

export interface CockpitFile {
  fields: Record<string, string | boolean>;
  sup: Record<string, Record<string, string | boolean>>;
  log: Array<Record<string, string>>;
}

/* ═══ Tables de correspondance ═══ */

/** Clés du cahier des charges, dans l'ordre des lignes du cockpit. */
const CDC_KEYS = ['diam', 'prof', 'comp', 'couv', 'meca', 'mat', 'col', 'usage', 'conf'] as const;

/** Champ de devis ↔ attribut data-f du cockpit. */
const QUOTE_FIELDS: Array<[keyof SourcingQuote, string]> = [
  ['contact_name', 'interlo'],
  ['channel', 'canal'],
  ['sent_at', 'dEnvoi'],
  ['replied_at', 'dRep'],
  ['twist_lock', 'twist'],
  ['twist_proof', 'twistPreuve'],
  ['dfm_notes', 'dfm'],
  ['currency', 'cur'],
  ['price_5k', 'p5'],
  ['price_10k', 'p10'],
  ['price_20k', 'p20'],
  ['moq', 'moq'],
  ['mould_plate_cost', 'mA'],
  ['mould_lid_cost', 'mC'],
  ['cavities', 'cav'],
  ['mould_life_cycles', 'vie'],
  ['mould_ownership', 'prop'],
  ['sample_cost', 'echCout'],
  ['sample_days', 'echDelai'],
  ['tooling_days', 'dT1'],
  ['production_days', 'dProd'],
  ['sets_per_carton', 'setsCart'],
  ['carton_volume_m3', 'volCart'],
  ['carton_weight_kg', 'poidsCart'],
  ['port', 'port'],
  ['incoterm', 'incoterm'],
  ['payment_terms', 'paiement'],
  ['notes', 'notes'],
];

const NUMERIC_QUOTE_FIELDS = new Set<keyof SourcingQuote>([
  'price_5k', 'price_10k', 'price_20k', 'moq',
  'mould_plate_cost', 'mould_lid_cost', 'mould_life_cycles',
  'sample_cost', 'sample_days', 'tooling_days', 'production_days',
  'sets_per_carton', 'carton_volume_m3', 'carton_weight_kg',
]);

const CERT_FIELDS: Array<[keyof SourcingQuote, string]> = [
  ['cert_fda', 'cFDA'],
  ['cert_lfgb', 'cLFGB'],
  ['cert_iso', 'cISO'],
  ['cert_migration', 'cMig'],
];

const PARAM_KEYS: Array<[keyof SourcingParams, string]> = [
  ['qty', '#p_qty'],
  ['freight_rate_eur_m3', '#p_freight'],
  ['insurance_pct', '#p_ins'],
  ['duty_pct', '#p_duty'],
  ['vat_pct', '#p_vat'],
];

const WEIGHT_KEYS: Array<[keyof SourcingWeights, string]> = [
  ['twist', '#w_twist'],
  ['conf', '#w_conf'],
  ['solid', '#w_solid'],
  ['cost', '#w_cost'],
  ['moq', '#w_moq'],
  ['lead', '#w_lead'],
];

/** Le cockpit n'a pas de champ pour l'euro : son taux vaut 1 par construction. */
const FX_CODES = ['USD', 'CNY', 'THB', 'VND', 'INR', 'MYR', 'TWD'] as const;

const CONDITION_STATE_LABELS: Record<string, ConditionState> = {
  Oui: 'oui',
  Non: 'non',
  'N/A': 'na',
};
const CONDITION_STATE_TO_LABEL: Record<ConditionState, string> = {
  oui: 'Oui',
  non: 'Non',
  na: 'N/A',
};

/** Le cockpit stocke le statut par son libellé français, pas par sa clé. */
const STATUS_FROM_LABEL = new Map<string, QuoteStatus>(
  (Object.entries(QUOTE_STATUS_LABELS) as Array<[QuoteStatus, string]>).map(([k, v]) => [v, k]),
);

const TWIST_VALUES = new Set<string>(['refus', 'etude', 'oui_decl', 'oui_photo', 'oui_ref']);
const OWNERSHIP_VALUES = new Set<string>(['acheteur', 'usine', 'partagee']);

const s = (v: unknown): string => (v == null ? '' : String(v));
const orNull = (v: unknown): string | null => {
  const t = s(v).trim();
  return t ? t : null;
};

/* ═══ Export : modèle → fichier cockpit ═══ */

export interface ExportInput {
  project: SourcingProject;
  suppliers: Array<{ supplier: SourcingSupplier; quote: SourcingQuote | null }>;
  conditions: SourcingCondition[];
  log: SourcingContactLogEntry[];
}

export function toCockpitFile({ project, suppliers, conditions, log }: ExportInput): CockpitFile {
  const fields: Record<string, string | boolean> = {};

  fields['meta.projet'] = s(project.title);
  fields['meta.client'] = s(project.client);
  fields['meta.acheteur'] = s(project.buyer);

  const decision = (project.decision ?? {}) as Record<string, unknown>;
  fields['meta.date'] = s(decision.date);

  // Cahier des charges : lignes appariées par position, comme dans le cockpit
  // où chaque ligne porte une clé fixe.
  const specRows =
    (project.spec as { rows?: Array<{ value?: unknown; tolerance?: unknown }> } | null)?.rows ?? [];
  CDC_KEYS.forEach((key, i) => {
    fields[`cdc.${key}`] = s(specRows[i]?.value);
    fields[`cdc.${key}Tol`] = s(specRows[i]?.tolerance);
  });

  conditions.forEach((c, i) => {
    fields[`cond.${i}.ok`] = c.state ? CONDITION_STATE_TO_LABEL[c.state] : '';
    fields[`cond.${i}.date`] = s(c.resolved_on);
    fields[`cond.${i}.note`] = s(c.evidence);
  });

  fields['dec.rep'] = s(decision.answer);
  fields['dec.retenu'] = s(decision.winner);
  fields['dec.secours'] = s(decision.backup);
  fields['dec.date'] = s(decision.date);
  fields['dec.motif'] = s(decision.rationale);
  fields['dec.actions'] = s(decision.actions);

  const params = project.params;
  for (const [key, id] of PARAM_KEYS) fields[id] = s(params?.[key]);
  const weights = project.weights;
  for (const [key, id] of WEIGHT_KEYS) fields[id] = s(weights?.[key]);
  for (const code of FX_CODES) fields[`#fx_${code}`] = s(params?.fx?.[code]);

  const sup: CockpitFile['sup'] = {};
  for (const { supplier, quote } of suppliers) {
    // Sans ext_id, le fournisseur n'a pas de correspondant dans le fichier
    // autonome : on ne l'y place pas sous une clé inventée.
    if (!supplier.ext_id) continue;
    const entry: Record<string, string | boolean> = {};
    entry.incl = supplier.included ? '1' : '0';
    entry.solid = s(supplier.solidity);
    if (quote) {
      entry.statut = QUOTE_STATUS_LABELS[quote.status] ?? '';
      for (const [field, key] of QUOTE_FIELDS) entry[key] = s(quote[field]);
      for (const [field, key] of CERT_FIELDS) entry[key] = quote[field] === true;
    }
    sup[supplier.ext_id] = entry;
  }

  const byId = new Map(suppliers.map(({ supplier }) => [supplier.id, supplier.ext_id ?? '']));

  return {
    fields,
    sup,
    log: log.map((e) => ({
      d: s(e.happened_on),
      f: e.supplier_id ? (byId.get(e.supplier_id) ?? '') : '',
      c: s(e.channel),
      i: s(e.contact_name),
      o: [e.subject, e.outcome].filter(Boolean).join(' — '),
    })),
  };
}

/* ═══ Import : fichier cockpit → patchs ═══ */

export interface ImportResult {
  project: Partial<SourcingProject>;
  /** Patchs de fournisseur et de devis, indexés par ext_id. */
  suppliers: Record<string, { supplier: Partial<SourcingSupplier>; quote: Partial<SourcingQuote> }>;
  /** Par position de condition, comme dans le fichier. */
  conditions: Array<{ position: number; patch: Partial<SourcingCondition> }>;
  log: Array<Partial<SourcingContactLogEntry> & { supplierExtId: string | null }>;
}

export function fromCockpitFile(file: unknown): ImportResult {
  const f = (file ?? {}) as Partial<CockpitFile>;
  const fields = (f.fields ?? {}) as Record<string, string | boolean>;
  const supRaw = (f.sup ?? {}) as Record<string, Record<string, string | boolean>>;
  const logRaw = Array.isArray(f.log) ? f.log : [];

  /* -- Projet -- */
  const project: Partial<SourcingProject> = {};
  if (orNull(fields['meta.projet'])) project.title = s(fields['meta.projet']).trim();
  if ('meta.client' in fields) project.client = orNull(fields['meta.client']);
  if ('meta.acheteur' in fields) project.buyer = orNull(fields['meta.acheteur']);

  const rows = CDC_KEYS.map((key, i) => ({
    label: SPEC_ROWS[i] ?? key,
    value: s(fields[`cdc.${key}`]),
    tolerance: s(fields[`cdc.${key}Tol`]),
  }));
  if (rows.some((r) => r.value || r.tolerance)) project.spec = { rows };

  const decision: Record<string, unknown> = {};
  if (orNull(fields['dec.rep'])) decision.answer = s(fields['dec.rep']).trim();
  if (orNull(fields['dec.retenu'])) decision.winner = s(fields['dec.retenu']).trim();
  if (orNull(fields['dec.secours'])) decision.backup = s(fields['dec.secours']).trim();
  if (orNull(fields['dec.date'])) decision.date = s(fields['dec.date']).trim();
  if (orNull(fields['dec.motif'])) decision.rationale = s(fields['dec.motif']).trim();
  if (orNull(fields['dec.actions'])) decision.actions = s(fields['dec.actions']).trim();
  if (Object.keys(decision).length) project.decision = decision;

  const params: Partial<SourcingParams> = {};
  for (const [key, id] of PARAM_KEYS) {
    const v = num(fields[id]);
    if (v != null) (params as Record<string, unknown>)[key] = v;
  }
  const fx: Record<string, number> = {};
  for (const code of FX_CODES) {
    const v = num(fields[`#fx_${code}`]);
    if (v != null) fx[code] = v;
  }
  if (Object.keys(fx).length) {
    // Le cockpit n'expose pas de champ pour l'euro : son taux est 1 par définition.
    params.fx = { EUR: 1, ...fx };
  }
  if (Object.keys(params).length) project.params = params as SourcingParams;

  const weights: Partial<SourcingWeights> = {};
  for (const [key, id] of WEIGHT_KEYS) {
    const v = num(fields[id]);
    if (v != null) (weights as Record<string, unknown>)[key] = v;
  }
  if (Object.keys(weights).length) project.weights = weights as SourcingWeights;

  /* -- Conditions -- */
  const conditions: ImportResult['conditions'] = [];
  for (const key of Object.keys(fields)) {
    const m = /^cond\.(\d+)\.ok$/.exec(key);
    if (!m) continue;
    const position = Number(m[1]);
    const label = s(fields[`cond.${position}.ok`]).trim();
    conditions.push({
      position,
      patch: {
        state: CONDITION_STATE_LABELS[label] ?? null,
        resolved_on: orNull(fields[`cond.${position}.date`]),
        evidence: orNull(fields[`cond.${position}.note`]),
      },
    });
  }
  conditions.sort((a, b) => a.position - b.position);

  /* -- Fournisseurs -- */
  const suppliers: ImportResult['suppliers'] = {};
  for (const [extId, raw] of Object.entries(supRaw)) {
    const supplier: Partial<SourcingSupplier> = {};
    const quote: Partial<SourcingQuote> = {};

    if ('incl' in raw) supplier.included = s(raw.incl) === '1';
    if ('solid' in raw) supplier.solidity = num(raw.solid);

    if ('statut' in raw) {
      const status = STATUS_FROM_LABEL.get(s(raw.statut).trim());
      if (status) quote.status = status;
    }

    for (const [field, key] of QUOTE_FIELDS) {
      if (!(key in raw)) continue;
      const value = raw[key];
      if (NUMERIC_QUOTE_FIELDS.has(field)) {
        (quote as Record<string, unknown>)[field] = num(value);
      } else if (field === 'twist_lock') {
        const t = s(value).trim();
        quote.twist_lock = TWIST_VALUES.has(t) ? (t as TwistLock) : null;
      } else if (field === 'mould_ownership') {
        const o = s(value).trim();
        quote.mould_ownership = OWNERSHIP_VALUES.has(o) ? (o as MouldOwnership) : null;
      } else {
        (quote as Record<string, unknown>)[field] = orNull(value);
      }
    }

    for (const [field, key] of CERT_FIELDS) {
      if (key in raw) {
        (quote as Record<string, unknown>)[field] = raw[key] === true || raw[key] === 'true';
      }
    }

    suppliers[extId] = { supplier, quote };
  }

  /* -- Journal -- */
  const log = logRaw
    .map((row) => ({
      happened_on: orNull(row.d),
      supplierExtId: orNull(row.f),
      channel: orNull(row.c),
      contact_name: orNull(row.i),
      outcome: orNull(row.o),
    }))
    .filter((e) => e.happened_on || e.channel || e.contact_name || e.outcome);

  return { project, suppliers, conditions, log };
}
