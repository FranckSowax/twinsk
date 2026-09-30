import { NextRequest, NextResponse } from 'next/server';
import { clientActor, errorResponse, readUpload } from '@/lib/projects/auth';
import { logEvent, storeDocument } from '@/lib/projects/data';
import type { DocumentCategory } from '@/lib/projects/types';

// POST multipart (client) : dépôt de documents ou de pièces jointes (jamais internes).
export const dynamic = 'force-dynamic';
const CATS: DocumentCategory[] = ['site', 'technical', 'admin', 'reports', 'misc'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const c = await clientActor(token);
    if (!c) return NextResponse.json({ error: 'Lien invalide, expiré ou révoqué' }, { status: 404 });
    const form = await request.formData();
    const category = String(form.get('category') || 'misc') as DocumentCategory;
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });
    const out = [];
    for (const f of files.slice(0, 10)) {
      const d = await storeDocument(c.projectId, await readUpload(f), { category: CATS.includes(category) ? category : 'misc', internal: false }, c.actor);
      out.push({ id: d.id, attachment: { ...d.attachment, url: `/api/projects/public/${token}/documents/${d.id}` } });
      await logEvent(c.projectId, { type: 'document.uploaded', actor: c.actor, target_type: 'document', target_id: d.id, detail: d.attachment.name, notify: 'team' });
    }
    return NextResponse.json({ documents: out });
  } catch (e) {
    return errorResponse(e);
  }
}
