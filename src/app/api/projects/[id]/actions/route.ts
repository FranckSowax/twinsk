import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse } from '@/lib/projects/auth';
import * as D from '@/lib/projects/data';
import { validateSourcingImport } from '@/lib/projects/sourcing';
import type { Attachment, ExchangeChannel, OrderStatus, RfqSender, SupplierStatus } from '@/lib/projects/types';

// POST { action, ... } : toutes les actions de l'équipe sur un projet.
export const dynamic = 'force-dynamic';

type Body = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const atts = (v: unknown): Attachment[] => (Array.isArray(v) ? (v as Attachment[]).filter((a) => a && typeof a.url === 'string') : []);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Body;
  try {
    let result: unknown = { ok: true };
    switch (str(b.action)) {
      case 'task.done': await D.setTaskDone(id, str(b.task_id), b.done !== false, actor); break;
      case 'task.checklist': await D.setTaskChecklist(id, str(b.task_id), str(b.item_id), b.done !== false, actor); break;
      case 'task.comment': await D.addTaskComment(id, str(b.task_id), str(b.text), atts(b.attachments), actor); break;
      case 'task.attach': await D.addTaskAttachments(id, str(b.task_id), atts(b.attachments), actor); break;
      case 'task.update': await D.updateTask(id, str(b.task_id), b as Parameters<typeof D.updateTask>[2], actor); break;
      case 'task.create': result = { id: await D.addTask(id, { step_key: str(b.step_key), title: str(b.title), description: str(b.description), owner: b.owner === 'client' ? 'client' : 'team', due_at: str(b.due_at) || null, phase: str(b.phase) || null, checklist: Array.isArray(b.checklist) ? (b.checklist as string[]) : [] }, actor) }; break;
      case 'update.publish': result = { id: await D.publishUpdate(id, { title: str(b.title), body: str(b.body), attachments: atts(b.attachments) }, actor) }; break;
      case 'update.comment': await D.addUpdateComment(id, str(b.update_id), str(b.text), actor); break;
      case 'question.reply': await D.replyQuestion(id, str(b.question_id), str(b.text), actor); break;
      case 'supplier.upsert': result = { id: await D.upsertSupplier(id, { ...(b as unknown as D.SupplierInput), id: str(b.id) || undefined, lot: str(b.lot), score: b.score === null || b.score === '' || b.score === undefined ? (b.score === undefined ? undefined : null) : Number(b.score) }, actor) }; break;
      case 'supplier.import': {
        const bundle = await D.loadProject(id);
        if (!bundle) throw new D.ProjectError('Projet introuvable', 404);
        const lots = [...new Set([...(bundle.quoteLines as { lot: string }[]).map((l) => l.lot), ...(bundle.rfq as { lot: string }[]).map((r) => r.lot), ...(bundle.suppliers as { lot: string }[]).map((x) => x.lot)])];
        const parsed = validateSourcingImport(b.data, { knownLots: lots });
        if (b.dry_run === true) { result = { preview: parsed }; break; }
        if (!parsed.suppliers.length) throw new D.ProjectError(parsed.warnings[0] || 'Aucune usine à importer');
        result = { ...(await D.importSuppliers(id, parsed.suppliers, actor)), warnings: parsed.warnings };
        break;
      }
      case 'supplier.photos': await D.setSupplierPhotos(id, str(b.id), Array.isArray(b.photos) ? (b.photos as { doc_id: string; caption: string }[]).filter((x) => x && typeof x.doc_id === 'string') : [], actor); break;
      case 'supplier.status': await D.setSupplierStatus(id, str(b.id), str(b.status) as SupplierStatus, actor); break;
      case 'supplier.delete': await D.deleteSupplier(id, str(b.id), actor); break;
      case 'rfq.save': await D.saveRfqMessage(id, str(b.lot), b as Parameters<typeof D.saveRfqMessage>[2], actor); break;
      case 'rfq.regenerate': result = { count: await D.regenerateRfqMessages(id, str(b.lot) || null, actor) }; break;
      case 'rfq.sender': await D.setRfqSender(id, (b.sender && typeof b.sender === 'object' ? b.sender : {}) as Partial<RfqSender>, actor); break;
      case 'exchange.add': result = { id: await D.addExchange(id, { supplier_id: str(b.supplier_id) || null, channel: (str(b.channel) || 'other') as ExchangeChannel, exchanged_at: str(b.exchanged_at) || undefined, summary: str(b.summary), attachments: atts(b.attachments), next_action: str(b.next_action), next_action_at: str(b.next_action_at) || null }, actor) }; break;
      case 'exchange.delete': await D.deleteExchange(id, str(b.id), actor); break;
      case 'quote.upsert': result = { id: await D.upsertQuoteLine(id, b as Parameters<typeof D.upsertQuoteLine>[1], actor) }; break;
      case 'fx.rates': await D.setRates(id, b.rates, actor); break;
      case 'fx.currency': await D.setProjectCurrency(id, str(b.currency), actor); break;
      case 'quote.delete': await D.deleteQuoteLine(id, str(b.line_id), actor); break;
      case 'quote.validate': await D.validateLine(id, str(b.line_id), actor); break;
      case 'quote.unvalidate': await D.unvalidateLine(id, str(b.line_id), actor); break;
      case 'order.create': result = { id: await D.createOrderFromValidated(id, Array.isArray(b.line_ids) ? (b.line_ids as string[]) : [], actor) }; break;
      case 'order.status': await D.advanceOrder(id, str(b.order_id), str(b.status) as OrderStatus, actor, typeof b.tracking === 'string' ? b.tracking : undefined); break;
      case 'phase.receive': await D.receivePhase(id, str(b.phase_id), b.received !== false, actor); break;
      case 'report.set': await D.setReport(id, str(b.phase), { checklist: Array.isArray(b.checklist) ? (b.checklist as D.ProjectBundle['finalReports'][number]['checklist']) : undefined, delivered: typeof b.delivered === 'boolean' ? b.delivered : undefined, file_id: b.file_id === undefined ? undefined : (str(b.file_id) || null) }, actor); break;
      case 'share.create': result = await D.createShare(id, { person_name: str(b.person_name), role_label: str(b.role_label), expires_at: str(b.expires_at) || null }, actor); break;
      case 'share.revoke': await D.revokeShare(id, str(b.share_id), actor); break;
      case 'document.delete': await D.deleteDocument(id, str(b.document_id), actor); break;
      default: return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
