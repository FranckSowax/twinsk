// Sourcing des usines par un skill externe (Cowork / Kimi), 30 sept. 2026.
// Deux formats JSON, versionnés :
//   - « twinsk-sourcing-brief-v1 » : le besoin exporté depuis l'onglet (lots,
//     lignes, quantités, exigences, sites), donné en entrée au skill ;
//   - « twinsk-sourcing-v1 » : le résultat du skill (3 usines par élément,
//     notation due diligence, fiche anonymisée, contacts), importé dans
//     l'onglet « Usines & échanges ».
// Pure et testée : validation tolérante, jamais d'exception ; la fiche client
// est vérifiée (aucun nom, site ni ville d'usine dans la description).

import type { ContactChannel, ProductSpec, RfqMessage, SampleStatus, Scores, SupplierStatus } from './types';

export const SOURCING_BRIEF_FORMAT = 'twinsk-sourcing-brief-v1';
export const SOURCING_RESULT_FORMAT = 'twinsk-sourcing-v1';

// ---- Besoin exporté (entrée du skill) ----
export interface SourcingBrief {
  format: typeof SOURCING_BRIEF_FORMAT;
  project: string;
  description: string | null;
  sites: string[];
  currency: string;
  context_en: string | null;
  common_requirements: string[];
  lots: { lot: string; product_en: string | null; quantities_en: string | null; requirements: string[]; lines: { label: string; unit: string; quantity: number; optional: boolean }[]; already_known: string[] }[];
  suppliers_per_element: number;
}
export function buildSourcingBrief(p: {
  title: string;
  description: string | null;
  currency: string;
  phases: { sites: string[] }[];
  lines: { lot: string; label: string; unit: string; quantity: number; optional: boolean }[];
  rfq: Pick<RfqMessage, 'lot' | 'product_en' | 'quantities_en' | 'requirements_en'>[];
  rfqContext?: { project_en?: string; requirements_en?: string[] } | null;
  knownSuppliers: { lot: string; real_name: string | null }[];
  lots: string[];
}): SourcingBrief {
  const lots = [...new Set([...p.lots, ...p.rfq.map((r) => r.lot), ...p.lines.map((l) => l.lot)])];
  return {
    format: SOURCING_BRIEF_FORMAT,
    project: p.title,
    description: p.description,
    sites: [...new Set(p.phases.flatMap((x) => x.sites))],
    currency: p.currency,
    context_en: p.rfqContext?.project_en || null,
    common_requirements: p.rfqContext?.requirements_en || [],
    lots: lots
      .map((lot) => {
        const r = p.rfq.find((x) => x.lot === lot);
        const lines = p.lines.filter((l) => l.lot === lot).map((l) => ({ label: l.label, unit: l.unit, quantity: l.quantity, optional: l.optional }));
        return { lot, product_en: r?.product_en || null, quantities_en: r?.quantities_en || null, requirements: r?.requirements_en || [], lines, already_known: p.knownSuppliers.filter((s) => s.lot === lot && s.real_name).map((s) => s.real_name!) };
      })
      .filter((l) => l.lines.length || l.product_en),
    suppliers_per_element: 3,
  };
}

// ---- Résultat du skill (import) ----
export interface ImportedSupplier {
  lot: string;
  element: string | null;
  real_name: string;
  city: string | null;
  country: string | null;
  website: string | null;
  contact: string | null; // vitrine Alibaba / Made-in-China
  contact_name: string | null;
  email: string | null;
  wechat: string | null;
  whatsapp: string | null;
  phone: string | null;
  preferred_channel: ContactChannel | null;
  contact_source: string | null;
  status: SupplierStatus;
  scores: Scores;
  description: string | null;
  product_specs: ProductSpec[];
  certifications: string[];
  years_experience: number | null;
  capacity: string | null;
  lead_time: string | null;
  moq: string | null;
  sample_status: SampleStatus | null;
  indicative_price: string | null;
  internal_note: string | null;
  /** Risques signalés par le skill → points à surveiller (équipe seulement). */
  watch_points: string[];
}
export interface SourcingImport {
  suppliers: ImportedSupplier[];
  warnings: string[];
  byLot: Record<string, number>;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const opt = (v: unknown, max: number) => str(v, max) || null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const CHANNELS: ContactChannel[] = ['email', 'wechat', 'whatsapp', 'alibaba', 'website', 'phone'];
const STATUSES: SupplierStatus[] = ['candidate', 'shortlisted', 'selected', 'rejected'];
const SAMPLES: SampleStatus[] = ['none', 'requested', 'received', 'validated'];
const KEYS = ['certifications', 'tropical', 'installation', 'price', 'transparency'] as const;
// Le skill peut nommer le 2e critère « climate » ou « site_fit » : même critère que « tropical ».
const ALIASES: Record<string, (typeof KEYS)[number]> = { climate: 'tropical', site_fit: 'tropical', adequacy: 'tropical', support: 'installation' };

/** Mots qui identifieraient l'usine dans la fiche client (nom, domaine du site, ville). */
export function identifyingTokens(s: { real_name: string; website?: string | null; city?: string | null }): string[] {
  const generic = new Set(['china', 'group', 'sports', 'sport', 'industry', 'industrial', 'technology', 'tech', 'co', 'ltd', 'limited', 'company', 'factory', 'manufacturing', 'international', 'trading', 'artificial', 'grass', 'lighting', 'membrane', 'machinery', 'the', 'and', 'with']);
  // Mots de 4 lettres et plus, ou sigles en capitales de 2-3 lettres (« AVG », « LDK »).
  const raw = [s.real_name, s.city || ''].join(' ').split(/[^\p{L}\p{N}]+/u);
  const words = raw.filter((w) => w.length >= 4 || (w.length >= 2 && w === w.toUpperCase() && /\p{L}/u.test(w))).map((w) => w.toLowerCase()).filter((w) => !generic.has(w));
  const domain = (s.website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/.]/)[0];
  return [...new Set([...words, ...(domain && domain.length >= 4 ? [domain] : [])])];
}
function leaks(text: string, tokens: string[]): string[] {
  const t = text.toLowerCase();
  // Sigles courts : mot entier seulement (« avg » ne doit pas toucher « average »).
  return tokens.filter((k) => (k.length <= 4 ? new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'u').test(t) : t.includes(k)));
}

function priceText(v: unknown): string | null {
  if (typeof v === 'string') return opt(v, 160);
  const o = obj(v);
  const min = Number(o.min ?? o.amount_min);
  const max = Number(o.max ?? o.amount_max);
  const cur = str(o.currency, 6).toUpperCase();
  if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
  const range = Number.isFinite(min) && Number.isFinite(max) && min !== max ? `${min}–${max}` : String(Number.isFinite(min) ? min : max);
  return [range, cur, str(o.unit, 20) && `/${str(o.unit, 20)}`, str(o.incoterm, 10)].filter(Boolean).join(' ').replace(' /', '/').slice(0, 160);
}

/** Résultat du skill → usines prêtes à enregistrer, avec les avertissements (jamais d'exception). */
export function validateSourcingImport(raw: unknown, opts: { knownLots?: string[] } = {}): SourcingImport {
  const warnings: string[] = [];
  const root = obj(raw);
  if (root.format && root.format !== SOURCING_RESULT_FORMAT) warnings.push(`Format « ${String(root.format)} » inattendu (attendu ${SOURCING_RESULT_FORMAT}) : import tenté quand même.`);
  // Accepte { lots: [{ lot, element, suppliers: [...] }] } ou une liste plate [{ lot, … }].
  const flat: { lot: string; element: string | null; s: Record<string, unknown> }[] = [];
  const lots = Array.isArray(raw) ? [{ lot: '', suppliers: raw }] : arr(root.lots).length ? arr(root.lots) : arr(root.suppliers).length ? [{ lot: '', suppliers: root.suppliers }] : [];
  for (const l of lots) {
    const lo = obj(l);
    const elements = arr(lo.elements).length ? arr(lo.elements).map(obj) : [lo];
    for (const e of elements) for (const s of arr(e.suppliers)) flat.push({ lot: str(lo.lot, 60), element: opt(e.element ?? lo.element, 160), s: obj(s) });
  }
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  const lotByNorm = new Map((opts.knownLots || []).map((l) => [norm(l), l]));
  const out: ImportedSupplier[] = [];
  for (const { lot: lotRaw, element, s } of flat) {
    const real_name = str(s.real_name ?? s.name ?? s.factory, 160);
    const lotIn = str(s.lot, 60) || lotRaw;
    if (!real_name || !lotIn) {
      warnings.push(`Usine ignorée : ${real_name ? `lot manquant (${real_name})` : 'nom manquant'}.`);
      continue;
    }
    const lot = lotByNorm.get(norm(lotIn)) || lotIn;
    if (opts.knownLots?.length && !lotByNorm.has(norm(lotIn))) warnings.push(`${real_name} : lot « ${lotIn} » absent du projet (créé tel quel).`);
    if (out.some((x) => x.lot === lot && norm(x.real_name) === norm(real_name))) {
      warnings.push(`${real_name} (${lot}) : doublon ignoré.`);
      continue;
    }
    const sc = obj(s.scores);
    const scores: Scores = {};
    for (const [k, v] of Object.entries(sc)) {
      const key = (KEYS as readonly string[]).includes(k) ? (k as (typeof KEYS)[number]) : ALIASES[k];
      const n = typeof v === 'object' && v ? Number(obj(v).score) : Number(v);
      if (key && Number.isFinite(n)) scores[key] = Math.min(5, Math.max(0, Math.round(n)));
    }
    const justif = Object.entries(sc)
      .map(([k, v]) => (typeof v === 'object' && v && str(obj(v).why ?? obj(v).justification, 200) ? `${k} : ${str(obj(v).why ?? obj(v).justification, 200)}` : ''))
      .filter(Boolean);
    const email = opt(s.email, 120);
    const whatsapp = opt(s.whatsapp, 40);
    const website = opt(s.website, 200);
    const city = opt(s.city, 80);
    const tokens = identifyingTokens({ real_name, website, city });
    let description = opt(s.description ?? s.public_description, 800);
    const specs = arr(s.product_specs).map(obj).map((x) => ({ label: str(x.label, 80), value: str(x.value, 300) })).filter((x) => x.label && x.value).slice(0, 30);
    if (description) {
      const l = leaks(description, tokens);
      if (l.length) {
        warnings.push(`${real_name} : description retirée (elle identifie l'usine : ${l.join(', ')}).`);
        description = null;
      }
    }
    const safeSpecs = specs.filter((x) => {
      const l = leaks(`${x.label} ${x.value}`, tokens);
      if (l.length) warnings.push(`${real_name} : caractéristique « ${x.label} » retirée (identifiante).`);
      return !l.length;
    });
    const statusIn = str(s.status, 20).toLowerCase() as SupplierStatus;
    const ch = str(s.preferred_channel, 20).toLowerCase() as ContactChannel;
    const sample = str(s.sample_status, 20).toLowerCase() as SampleStatus;
    const years = Number(s.years_experience);
    const risks = arr(s.risks).map((x) => str(x, 200)).filter(Boolean);
    const sources = arr(s.sources).map((x) => str(x, 300)).filter(Boolean);
    const conf = str(s.confidence ?? s.contact_confidence, 10).toLowerCase();
    out.push({
      lot,
      element: opt(s.element, 160) || element,
      real_name,
      city,
      country: opt(s.country, 60) || 'Chine',
      website,
      contact: opt(s.alibaba_url ?? s.marketplace_url, 300),
      contact_name: opt(s.contact_name, 120),
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      wechat: opt(s.wechat, 60),
      whatsapp: whatsapp && whatsapp.replace(/\D/g, '').length >= 8 ? whatsapp : null,
      phone: opt(s.phone, 40),
      preferred_channel: CHANNELS.includes(ch) ? ch : null,
      contact_source: [opt(s.contact_source, 300), conf ? `confiance ${conf}` : ''].filter(Boolean).join(' — ') || null,
      // Le skill propose ; seule l'équipe « retient » : un « selected » importé devient « shortlisted ».
      status: statusIn === 'selected' ? 'shortlisted' : STATUSES.includes(statusIn) ? statusIn : 'candidate',
      scores,
      description,
      product_specs: safeSpecs,
      certifications: arr(s.certifications).map((x) => str(x, 60)).filter(Boolean).slice(0, 20),
      years_experience: Number.isFinite(years) && years >= 0 && years < 200 ? Math.round(years) : null,
      capacity: opt(s.capacity, 160),
      lead_time: opt(s.lead_time, 120),
      moq: opt(s.moq, 120),
      sample_status: SAMPLES.includes(sample) ? sample : null,
      indicative_price: priceText(s.indicative_price),
      watch_points: [...risks, ...(conf === 'low' ? ['Contact de confiance faible : à vérifier avant d’écrire'] : [])].slice(0, 12),
      internal_note: [element || opt(s.element, 160) ? `Élément : ${opt(s.element, 160) || element}` : '', s.rank != null ? `Rang proposé : ${str(String(s.rank), 4)}` : '', justif.length ? `Notation — ${justif.join(' ; ')}` : '', sources.length ? `Sources : ${sources.join(' ')}` : '', opt(s.internal_note ?? s.notes, 600) || '']
        .filter(Boolean)
        .join('\n')
        .slice(0, 3000) || null,
    });
  }
  if (!out.length && !warnings.length) warnings.push('Aucune usine trouvée dans le JSON.');
  const byLot: Record<string, number> = {};
  for (const s of out) byLot[s.lot] = (byLot[s.lot] || 0) + 1;
  return { suppliers: out, warnings, byLot };
}
