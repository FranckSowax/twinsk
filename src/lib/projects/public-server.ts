// Construit l'entrée de la projection publique à partir du projet complet :
// seuls les champs nommés dans RawForPublic sont copiés ; les pièces jointes
// pointent vers la route de téléchargement du jeton ; les documents internes
// sont écartés. Le module ne connaît ni fournisseurs réels ni échanges usines.
import type { ProjectBundle } from './data';
import { projectPublicView, type PublicProject, type RawForPublic } from './public';
import { templateByKey, DOM_TOM_TEMPLATE } from './templates/dom-tom';
import type { Attachment } from './types';

export function toPublicView(b: ProjectBundle, token: string): PublicProject {
  const p = b.project as Record<string, unknown>;
  const internalDocs = new Set((b.documents as { id: string; internal: boolean }[]).filter((d) => d.internal).map((d) => d.id));
  const pub = (list: Attachment[] | null | undefined): Attachment[] =>
    (list || [])
      .map((a) => {
        const m = /\/documents\/([0-9a-f-]{36})$/i.exec(a.url || '');
        const docId = m?.[1];
        if (docId && internalDocs.has(docId)) return null;
        return { name: a.name, url: docId ? `/api/projects/public/${token}/documents/${docId}` : a.url, size: a.size, kind: a.kind, by: a.by, at: a.at };
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
    documents: (b.documents as (RawForPublic['documents'][number] & { internal: boolean })[]).filter((d) => !d.internal).map((d) => ({ id: d.id, category: d.category, name: d.name, size: d.size, uploaded_by: d.uploaded_by, created_at: d.created_at })),
    quoteLines: (b.quoteLines as RawForPublic['quoteLines']).map((l) => ({ id: l.id, lot: l.lot, label: l.label, unit: l.unit, quantity: Number(l.quantity), client_quantity: l.client_quantity == null ? null : Number(l.client_quantity), unit_price: l.unit_price == null ? null : Number(l.unit_price), optional: l.optional, enabled: l.enabled, status: l.status, phase: l.phase, validated_at: l.validated_at, supplier_id: l.supplier_id })),
    orders: (b.orders as RawForPublic['orders']).map((o) => ({ id: o.id, reference: o.reference, status: o.status, tracking: o.tracking, line_ids: o.line_ids, total: Number(o.total), created_at: o.created_at, updated_at: o.updated_at })),
    suppliers: (b.suppliers as RawForPublic['suppliers']).map((s) => ({ id: s.id, lot: s.lot, alias: s.alias, score: s.score == null ? null : Number(s.score) })),
    finalReports: (b.finalReports as RawForPublic['finalReports']).map((r) => ({ phase: r.phase, checklist: r.checklist || [], delivered_at: r.delivered_at, file_id: r.file_id })),
  };
  return projectPublicView(raw, token);
}
