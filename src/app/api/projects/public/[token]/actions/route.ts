import { NextRequest, NextResponse } from 'next/server';
import { clientActor, errorResponse } from '@/lib/projects/auth';
import * as D from '@/lib/projects/data';
import type { Attachment } from '@/lib/projects/types';

// POST { action, ... } (client) : cocher ses tâches, commenter, poser une
// question, régler quantités et options, valider ou dévalider une ligne,
// s'intéresser au voyage. Rien d'autre.
export const dynamic = 'force-dynamic';
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const atts = (v: unknown): Attachment[] => (Array.isArray(v) ? (v as Attachment[]).filter((a) => a && typeof a.url === 'string' && a.url.includes('/api/projects/public/')) : []);

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const c = await clientActor(token);
    if (!c) return NextResponse.json({ error: 'Lien invalide, expiré ou révoqué' }, { status: 404 });
    const { actor, projectId } = c;
    let result: unknown = { ok: true };
    switch (str(b.action)) {
      case 'task.done': await D.setTaskDone(projectId, str(b.task_id), b.done !== false, actor); break;
      case 'task.checklist': await D.setTaskChecklist(projectId, str(b.task_id), str(b.item_id), b.done !== false, actor); break;
      case 'task.comment': await D.addTaskComment(projectId, str(b.task_id), str(b.text), atts(b.attachments), actor); break;
      case 'update.comment': await D.addUpdateComment(projectId, str(b.update_id), str(b.text), actor); break;
      case 'question.ask': result = { id: await D.askQuestion(projectId, { subject: str(b.subject), detail: str(b.detail), attachment: atts([b.attachment])[0] || null }, actor) }; break;
      case 'question.reply': await D.replyQuestion(projectId, str(b.question_id), str(b.text), actor, atts(b.attachments)); break;
      case 'quote.choice': await D.setClientLineChoice(projectId, str(b.line_id), { client_quantity: b.client_quantity === undefined ? undefined : b.client_quantity === null ? null : Number(b.client_quantity), enabled: typeof b.enabled === 'boolean' ? b.enabled : undefined }, actor); break;
      case 'quote.validate': await D.validateLine(projectId, str(b.line_id), actor); break;
      case 'quote.unvalidate': await D.unvalidateLine(projectId, str(b.line_id), actor); break;
      case 'trip.interested': await D.businessTrip(projectId, 'interested', actor); break;
      case 'trip.quote': await D.businessTrip(projectId, 'quote', actor); break;
      default: return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
