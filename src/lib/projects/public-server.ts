// Construit l'entrée de la projection publique à partir du projet complet :
// seuls les champs nommés dans RawForPublic sont copiés ; les pièces jointes
// pointent vers la route de téléchargement du jeton ; les documents internes
// sont écartés. Le module ne connaît ni fournisseurs réels ni échanges usines.
import type { ProjectBundle } from './data';
import { projectPublicView, type PublicProject, type RawForPublic } from './public';
import { templateByKey, DOM_TOM_TEMPLATE } from './templates/dom-tom';
import type { Attachment } from './types';

/** Vue de l'équipe : mêmes champs que le client, plus documents internes et chemins admin. */
export interface TeamExtras {
  client: { name: string | null; company: string | null; phone: string | null; email: string | null };
  template_key: string | null;
  lots: string[];
  suppliers: { id: string; lot: string; alias: string; real_name: string | null; contact: string | null; country: string | null; score: number | null; internal_note: string | null }[];
  exchanges: { id: string; supplier_id: string | null; channel: string; exchanged_at: string; summary: string; attachments: Attachment[]; next_action: string | null; next_action_at: string | null; author_name: string | null }[];
  shares: { id: string; token: string; person_name: string; role_label: string | null; expires_at: string | null; revoked_at: string | null; views: number; last_seen_at: string | null; created_at: string }[];
  events: { id: string; type: string; actor: string; actor_name: string | null; detail: string | null; notify: string | null; notified_at: string | null; created_at: string }[];
  line_costs: Record<string, { unit_cost: number | null; supplier_id: string | null }>;
  documents_internal: string[];
  task_keys: Record<string, string>;
}
export function toTeamView(b: ProjectBundle): PublicProject & { admin: TeamExtras } {
  const id = String((b.project as { id: string }).id);
  const view = buildView(b, '', { docPath: (docId) => `/api/projects/${id}/documents/${docId}`, includeInternal: true });
  const p = b.project as Record<string, unknown>;
  const template = templateByKey(String(p.template_key || '')) || DOM_TOM_TEMPLATE;
  const admin: TeamExtras = {
    client: { name: (p.client_name as string) ?? null, company: (p.client_company as string) ?? null, phone: (p.client_phone as string) ?? null, email: (p.client_email as string) ?? null },
    template_key: (p.template_key as string) ?? null,
    lots: template.lots,
    suppliers: (b.suppliers as TeamExtras['suppliers']).map((s) => ({ id: s.id, lot: s.lot, alias: s.alias, real_name: s.real_name, contact: s.contact, country: s.country, score: s.score == null ? null : Number(s.score), internal_note: s.internal_note })),
    exchanges: (b.exchanges as TeamExtras['exchanges']).map((e) => ({ id: e.id, supplier_id: e.supplier_id, channel: e.channel, exchanged_at: e.exchanged_at, summary: e.summary, attachments: e.attachments || [], next_action: e.next_action, next_action_at: e.next_action_at, author_name: e.author_name })),
    shares: (b.shares as TeamExtras['shares']).map((s) => ({ id: s.id, token: s.token, person_name: s.person_name, role_label: s.role_label, expires_at: s.expires_at, revoked_at: s.revoked_at, views: s.views, last_seen_at: s.last_seen_at, created_at: s.created_at })),
    events: (b.events as TeamExtras['events']).map((e) => ({ id: e.id, type: e.type, actor: e.actor, actor_name: e.actor_name, detail: e.detail, notify: e.notify, notified_at: e.notified_at, created_at: e.created_at })),
    line_costs: Object.fromEntries((b.quoteLines as { id: string; unit_cost: number | null; supplier_id: string | null }[]).map((l) => [l.id, { unit_cost: l.unit_cost == null ? null : Number(l.unit_cost), supplier_id: l.supplier_id }])),
    documents_internal: (b.documents as { id: string; internal: boolean }[]).filter((d) => d.internal).map((d) => d.id),
    task_keys: Object.fromEntries((b.tasks as { id: string; key: string }[]).map((t) => [t.id, t.key])),
  };
  return { ...view, admin };
}

export function toPublicView(b: ProjectBundle, token: string): PublicProject {
  return buildView(b, token, { includeInternal: false });
}

function buildView(b: ProjectBundle, token: string, opts: { docPath?: (docId: string) => string; includeInternal: boolean }): PublicProject {
  const p = b.project as Record<string, unknown>;
  const internalDocs = new Set((b.documents as { id: string; internal: boolean }[]).filter((d) => d.internal).map((d) => d.id));
  const docPath = opts.docPath || ((docId: string) => `/api/projects/public/${token}/documents/${docId}`);
  const pub = (list: Attachment[] | null | undefined): Attachment[] =>
    (list || [])
      .map((a) => {
        const m = /\/documents\/([0-9a-f-]{36})$/i.exec(a.url || '');
        const docId = m?.[1];
        if (docId && internalDocs.has(docId) && !opts.includeInternal) return null;
        return { name: a.name, url: docId ? docPath(docId) : a.url, size: a.size, kind: a.kind, by: a.by, at: a.at };
      })
      .filter((a): a is Attachment => !!a);
  const template = templateByKey(String(p.template_key || '')) || DOM_TOM_TEMPLATE;
  const raw: RawForPublic = {
    project: { title: String(p.title), description: (p.description as string | null) ?? null, currency: String(p.currency), status: String(p.status), phases: (p.phases as RawForPublic['project']['phases']) || [], business_trip_interested_at: (p.business_trip_interested_at as string | null) ?? null, business_trip_quote_requested_at: (p.business_trip_quote_requested_at as string | null) ?? null },
    template: { business_trip: template.business_trip },
    steps: (b.steps as RawForPublic['steps']).map((s) => ({ key: s.key, title: s.title, description: s.description, position: s.position })),
    tasks: (b.tasks as (RawForPublic['tasks'][number] & { attachments: Attachment[] })[]).map((t) => ({ id: t.id, step_key: t.step_key, title: t.title, description: t.description, owner: t.owner, phase: t.phase, due_at: t.due_at, status: t.status, checklist: t.checklist || [], attachments: pub(t.attachments) })),
    taskComments: (b.taskComments as (RawForPublic['taskComments'][number] & { attachments: Attachment[] })[]).map((c) => ({ id: c.id, task_id: c.task_id, author: c.author, author_name: c.author_name, text: c.text, attachments: pub(c.attachments), created_at: c.created_at })),
    updates: (b.updates as (RawForPublic['updates'][number] & { attachments: Attachment[] })[]).map((u) => ({ id: u.id, title: u.title, body: u.body, attachments: pub(u.attachments), published_at: u.published_at })),
    updateComments: (b.updateComments as RawForPublic['updateComments']).map((c) => ({ id: c.id, update_id: c.update_id, author: c.author, author_name: c.author_name, text: c.text, created_at: c.created_at })),
    questions: (b.questions as (RawForPublic['questions'][number] & { attachment: Attachment | null })[]).map((q) => ({ id: q.id, subject: q.subject, detail: q.detail, attachment: q.attachment ? pub([q.attachment])[0] || null : null, status: q.status, created_at: q.created_at })),
    questionReplies: (b.questionReplies as RawForPublic['questionReplies']).map((r) => ({ id: r.id, question_id: r.question_id, author: r.author, author_name: r.author_name, text: r.text, created_at: r.created_at })),
    documents: (b.documents as (RawForPublic['documents'][number] & { internal: boolean })[]).filter((d) => opts.includeInternal || !d.internal).map((d) => ({ id: d.id, category: d.category, name: d.name, size: d.size, uploaded_by: d.uploaded_by, created_at: d.created_at })),
    quoteLines: (b.quoteLines as RawForPublic['quoteLines']).map((l) => ({ id: l.id, lot: l.lot, label: l.label, unit: l.unit, quantity: Number(l.quantity), client_quantity: l.client_quantity == null ? null : Number(l.client_quantity), unit_price: l.unit_price == null ? null : Number(l.unit_price), optional: l.optional, enabled: l.enabled, status: l.status, phase: l.phase, validated_at: l.validated_at, supplier_id: l.supplier_id })),
    orders: (b.orders as RawForPublic['orders']).map((o) => ({ id: o.id, reference: o.reference, status: o.status, tracking: o.tracking, line_ids: o.line_ids, total: Number(o.total), created_at: o.created_at, updated_at: o.updated_at })),
    suppliers: (b.suppliers as RawForPublic['suppliers']).map((s) => ({ id: s.id, lot: s.lot, alias: s.alias, score: s.score == null ? null : Number(s.score) })),
    finalReports: (b.finalReports as RawForPublic['finalReports']).map((r) => ({ phase: r.phase, checklist: r.checklist || [], delivered_at: r.delivered_at, file_id: r.file_id })),
  };
  return projectPublicView(raw, token, { docPath });
}
