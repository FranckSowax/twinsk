/**
 * Projection publique d'un projet (page client /projet/<jeton>) — section la
 * plus sensible du module. Construite CHAMP PAR CHAMP, nommément : jamais de
 * décomposition d'un objet de la base, jamais d'omit(). public.test.ts échoue
 * si un champ interdit sort (nom d'usine, prix d'achat, contact fournisseur,
 * échanges avec les usines, jetons).
 */

import type { Attachment, ChecklistItem, DocumentCategory, OrderStatus, Phase, ProductPhoto, ProductSpec, QuestionStatus, QuoteLineStatus, SampleStatus, Scores, SupplierStatus, TaskOwner, TaskStatus } from './types';
import { CLIENT_DISCLAIMER } from './types';
import { effectiveQuantity, isPhaseLocked, lineTotal, progress, quoteTotals, rankSuppliers } from './logic';
import { rateOf, toBase, type Rates } from './fx';

/** Champs qui ne doivent JAMAIS apparaître dans la sortie publique. */
export const FORBIDDEN_PUBLIC_FIELDS = ['supplier_name', 'real_name', 'contact', 'unit_cost', 'cost', 'margin', 'token', 'exchanges', 'internal_note', 'wechat', 'factory', 'website', 'email', 'whatsapp', 'phone', 'contact_name', 'contact_source', 'indicative_price', 'rfq_sender', 'email_body_en', 'short_zh', 'cover_video_path', 'storage_path', 'watch_points', 'supplier_id', 'exchange_id', 'analysis'];

export interface PublicProject {
  title: string;
  description: string | null;
  currency: string;
  status: string;
  disclaimer: string;
  /** Vidéo de couverture : version (date de mise à jour) pour l'adresse …/cover?v= ; jamais le chemin de stockage. */
  cover_video: { version: string } | null;
  phases: { id: string; name: string; order: number; sites: string[]; received: boolean; locked: boolean }[];
  progress: { global: number; bySteps: Record<string, number> };
  steps: { key: string; title: string; description: string; position: number }[];
  tasks: {
    id: string;
    step_key: string;
    title: string;
    description: string;
    owner: TaskOwner;
    phase: string | null;
    due_at: string;
    status: TaskStatus;
    locked: boolean;
    checklist: ChecklistItem[];
    attachments: Attachment[];
    comments: { id: string; author: 'team' | 'client'; author_name: string; text: string; attachments: Attachment[]; at: string }[];
  }[];
  updates: { id: string; title: string; body: string; attachments: Attachment[]; at: string; comments: { id: string; author: 'team' | 'client'; author_name: string; text: string; at: string }[] }[];
  /** direction : from_client = posée par le client ; to_client = posée par l'équipe, le client répond. */
  questions: { id: string; subject: string; detail: string; attachment: Attachment | null; status: QuestionStatus; direction: 'from_client' | 'to_client'; lot: string | null; at: string; replies: { id: string; author: 'team' | 'client'; author_name: string; text: string; at: string }[] }[];
  documents: { id: string; category: DocumentCategory; name: string; size: number | null; by: string; at: string; download_path: string }[];
  /** Taux « 1 devise = X devise principale » appliqués aux lignes saisies dans une autre devise. */
  rates: Rates;
  quote: {
    totals: { committed: number; pending: number; estimated: number; unpriced: number };
    lines: {
      id: string;
      lot: string;
      label: string;
      unit: string;
      quantity: number;
      client_quantity: number | null;
      effective_quantity: number;
      /** Prix unitaire dans la devise principale (converti) ; null si non chiffré ou taux manquant. */
      unit_price: number | null;
      /** Montant tel que saisi et sa devise (affiché quand elle diffère de la devise principale). */
      entered_price: number | null;
      price_currency: string;
      rate_missing: boolean;
      total: number | null;
      optional: boolean;
      enabled: boolean;
      status: QuoteLineStatus;
      phase: string | null;
      locked: boolean;
      validated_at: string | null;
      /** Alias du fournisseur pressenti (« Fournisseur B »), jamais son nom. */
      supplier_alias: string | null;
    }[];
  };
  orders: { id: string; reference: string; status: OrderStatus; tracking: string | null; lines: string[]; total: number; at: string; updated_at: string }[];
  business_trip: { title: string; days: { day: number; city: string; program: string }[]; interested_at: string | null; quote_requested_at: string | null };
  final_reports: { phase: string; checklist: ChecklistItem[]; delivered_at: string | null; download_path: string | null }[];
  /** Usines anonymisées : classement due diligence par lot, fiche produit, statut de sélection. */
  suppliers: {
    lot: string;
    alias: string;
    rank: number;
    status: SupplierStatus;
    score: number | null;
    scores: Scores;
    description: string | null;
    product_specs: ProductSpec[];
    certifications: string[];
    years_experience: number | null;
    capacity: string | null;
    lead_time: string | null;
    moq: string | null;
    sample_status: SampleStatus | null;
    country: string | null;
    /** Photos des produits reçues de l'usine : adresse servie par l'application, légende. */
    photos: { url: string; caption: string }[];
  }[];
}

/** Entrées brutes (lues par le serveur) : seuls les champs nommés ci-dessous sont copiés. */
export interface RawForPublic {
  project: { title: string; description: string | null; currency: string; rates: Rates; cover_video_at: string | null; status: string; phases: Phase[]; business_trip_interested_at: string | null; business_trip_quote_requested_at: string | null };
  template: { business_trip: { title: string; days: { day: number; city: string; program: string }[] } };
  steps: { key: string; title: string; description: string; position: number }[];
  tasks: { id: string; step_key: string; title: string; description: string; owner: TaskOwner; phase: string | null; due_at: string; status: TaskStatus; checklist: ChecklistItem[]; attachments: Attachment[] }[];
  taskComments: { id: string; task_id: string; author: 'team' | 'client'; author_name: string; text: string; attachments: Attachment[]; created_at: string }[];
  updates: { id: string; title: string; body: string; attachments: Attachment[]; published_at: string }[];
  updateComments: { id: string; update_id: string; author: 'team' | 'client'; author_name: string; text: string; created_at: string }[];
  questions: { id: string; subject: string; detail: string; attachment: Attachment | null; status: QuestionStatus; direction?: 'from_client' | 'to_client' | null; lot?: string | null; created_at: string }[];
  questionReplies: { id: string; question_id: string; author: 'team' | 'client'; author_name: string; text: string; created_at: string }[];
  documents: { id: string; category: DocumentCategory; name: string; size: number | null; uploaded_by: string; created_at: string }[];
  quoteLines: { id: string; lot: string; label: string; unit: string; quantity: number; client_quantity: number | null; unit_price: number | null; price_currency: string | null; validated_snapshot: { unit_price: number | null; total: number | null } | null; optional: boolean; enabled: boolean; status: QuoteLineStatus; phase: string | null; validated_at: string | null; supplier_id: string | null }[];
  orders: { id: string; reference: string; status: OrderStatus; tracking: string | null; line_ids: string[]; total: number; created_at: string; updated_at: string }[];
  suppliers: { id: string; lot: string; alias: string; status: SupplierStatus; scores: Scores; score: number | null; description: string | null; product_specs: ProductSpec[]; certifications: string[]; years_experience: number | null; capacity: string | null; lead_time: string | null; moq: string | null; sample_status: SampleStatus | null; country: string | null; product_photos: ProductPhoto[] }[];
  finalReports: { phase: string; checklist: ChecklistItem[]; delivered_at: string | null; file_id: string | null }[];
}

export function projectPublicView(raw: RawForPublic, token: string, opts: { docPath?: (docId: string) => string; photoPath?: (docId: string) => string } = {}): PublicProject {
  const docPath = opts.docPath || ((docId: string) => `/api/projects/public/${token}/documents/${docId}`);
  const photoPath = opts.photoPath || ((docId: string) => `/api/projects/public/${token}/photos/${docId}`);
  const phases = raw.project.phases;
  const aliasOf = new Map(raw.suppliers.map((s) => [s.id, s.alias]));
  const base = raw.project.currency;
  const rates = raw.project.rates || {};
  // Prix dans la devise principale : figé par l'instantané une fois validé, sinon converti au taux du jour.
  const basePrice = (l: RawForPublic['quoteLines'][number]) => (l.status !== 'draft' && l.validated_snapshot ? l.validated_snapshot.unit_price : toBase(l.unit_price, l.price_currency, base, rates));
  const lineLike = raw.quoteLines.map((l) => ({ id: l.id, lot: l.lot, quantity: l.quantity, client_quantity: l.client_quantity, unit_price: basePrice(l), optional: l.optional, enabled: l.enabled, status: l.status, phase: l.phase }));
  const totals = quoteTotals(lineLike);
  return {
    title: raw.project.title,
    description: raw.project.description,
    currency: raw.project.currency,
    rates,
    status: raw.project.status,
    disclaimer: CLIENT_DISCLAIMER,
    cover_video: raw.project.cover_video_at ? { version: String(new Date(raw.project.cover_video_at).getTime()) } : null,
    phases: [...phases].sort((a, b) => a.order - b.order).map((p) => ({ id: p.id, name: p.name, order: p.order, sites: p.sites, received: !!p.received_at, locked: isPhaseLocked(phases, p.id) })),
    progress: progress(raw.tasks.map((t) => ({ step_key: t.step_key, status: t.status }))),
    steps: raw.steps.map((s) => ({ key: s.key, title: s.title, description: s.description, position: s.position })),
    tasks: raw.tasks.map((t) => ({
      id: t.id,
      step_key: t.step_key,
      title: t.title,
      description: t.description,
      owner: t.owner,
      phase: t.phase,
      due_at: t.due_at,
      status: t.status,
      locked: isPhaseLocked(phases, t.phase),
      checklist: t.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done })),
      attachments: t.attachments.map(att),
      comments: raw.taskComments.filter((c) => c.task_id === t.id).map((c) => ({ id: c.id, author: c.author, author_name: c.author_name, text: c.text, attachments: c.attachments.map(att), at: c.created_at })),
    })),
    updates: raw.updates.map((u) => ({
      id: u.id,
      title: u.title,
      body: u.body,
      attachments: u.attachments.map(att),
      at: u.published_at,
      comments: raw.updateComments.filter((c) => c.update_id === u.id).map((c) => ({ id: c.id, author: c.author, author_name: c.author_name, text: c.text, at: c.created_at })),
    })),
    questions: raw.questions.map((q) => ({
      id: q.id,
      subject: q.subject,
      detail: q.detail,
      attachment: q.attachment ? att(q.attachment) : null,
      status: q.status,
      direction: q.direction === 'to_client' ? 'to_client' : 'from_client',
      lot: q.lot ?? null,
      at: q.created_at,
      replies: raw.questionReplies.filter((r) => r.question_id === q.id).map((r) => ({ id: r.id, author: r.author, author_name: r.author_name, text: r.text, at: r.created_at })),
    })),
    documents: raw.documents.map((d) => ({ id: d.id, category: d.category, name: d.name, size: d.size, by: d.uploaded_by, at: d.created_at, download_path: docPath(d.id) })),
    quote: {
      totals,
      lines: raw.quoteLines.map((l, i) => ({
        id: l.id,
        lot: l.lot,
        label: l.label,
        unit: l.unit,
        quantity: l.quantity,
        client_quantity: l.client_quantity,
        effective_quantity: effectiveQuantity(l),
        unit_price: lineLike[i].unit_price,
        entered_price: l.unit_price,
        price_currency: (l.price_currency || base).toUpperCase(),
        rate_missing: l.unit_price != null && lineLike[i].unit_price == null && rateOf(l.price_currency, base, rates) == null,
        total: lineTotal(lineLike[i]),
        optional: l.optional,
        enabled: l.enabled,
        status: l.status,
        phase: l.phase,
        locked: isPhaseLocked(phases, l.phase),
        validated_at: l.validated_at,
        supplier_alias: l.supplier_id ? aliasOf.get(l.supplier_id) || null : null,
      })),
    },
    orders: raw.orders.map((o) => ({ id: o.id, reference: o.reference, status: o.status, tracking: o.tracking, lines: o.line_ids, total: o.total, at: o.created_at, updated_at: o.updated_at })),
    business_trip: { title: raw.template.business_trip.title, days: raw.template.business_trip.days.map((d) => ({ day: d.day, city: d.city, program: d.program })), interested_at: raw.project.business_trip_interested_at, quote_requested_at: raw.project.business_trip_quote_requested_at },
    final_reports: raw.finalReports.map((r) => ({ phase: r.phase, checklist: r.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done })), delivered_at: r.delivered_at, download_path: r.delivered_at && r.file_id ? docPath(r.file_id) : null })),
    suppliers: rankSuppliers(raw.suppliers.map((s) => ({ id: s.id, lot: s.lot, alias: s.alias, status: s.status, scores: s.scores, score: s.score }))).map((r) => {
      const s = raw.suppliers.find((x) => x.id === r.id)!;
      return {
        lot: s.lot,
        alias: s.alias,
        rank: r.rank,
        status: s.status,
        score: r.score ?? s.score,
        scores: pickScores(s.scores),
        description: s.description,
        product_specs: (s.product_specs || []).map((x) => ({ label: x.label, value: x.value })),
        certifications: [...(s.certifications || [])],
        years_experience: s.years_experience,
        capacity: s.capacity,
        lead_time: s.lead_time,
        moq: s.moq,
        sample_status: s.sample_status,
        country: s.country,
        photos: (s.product_photos || []).map((x) => ({ url: photoPath(x.doc_id), caption: x.caption })),
      };
    }),
  };
}

function pickScores(s: Scores | null | undefined): Scores {
  const out: Scores = {};
  for (const k of ['certifications', 'tropical', 'installation', 'price', 'transparency'] as const) if (typeof s?.[k] === 'number') out[k] = s[k];
  return out;
}

function att(a: Attachment): Attachment {
  return { name: a.name, url: a.url, size: a.size, kind: a.kind, by: a.by, at: a.at };
}

/** Clés présentes dans un objet, en profondeur (pour le test de non-régression). */
export function deepKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => deepKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    out.add(k);
    deepKeys(x, out);
  }
  return out;
}
